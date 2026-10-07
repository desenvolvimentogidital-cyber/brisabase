import crypto from 'node:crypto';
import { postgres } from '../db/postgres';

export type UnifiedInfrastructureContext = {
  organizationId: string; projectId: string; environmentId: string; userId: string; role: string;
};

const VIEW = new Set(['owner','admin','developer','service']);
const MANAGE = new Set(['owner','admin','service']);
const SERVICES = [
  { id:'postgresql', name:'PostgreSQL', category:'database', description:'Banco relacional gerenciado', mode:'managed' },
  { id:'redis', name:'Redis', category:'cache', description:'Cache, sessões e filas rápidas', mode:'managed' },
  { id:'storage', name:'Object Storage', category:'storage', description:'Arquivos compatíveis com S3', mode:'managed' },
  { id:'containers', name:'Docker / Containers', category:'compute', description:'Containers e workloads', mode:'managed' },
  { id:'deploy', name:'Deploy', category:'compute', description:'Deploy versionado de aplicações', mode:'managed' },
  { id:'domains', name:'Domínios + HTTPS', category:'network', description:'Domínio, DNS e TLS', mode:'managed' },
  { id:'backups', name:'Backups', category:'reliability', description:'Backups e recuperação', mode:'managed' },
  { id:'logs', name:'Logs', category:'observability', description:'Logs centralizados', mode:'managed' },
  { id:'monitoring', name:'Monitoramento', category:'observability', description:'Saúde, métricas e alertas', mode:'managed' },
  { id:'email', name:'E-mail', category:'messaging', description:'SMTP e envio transacional', mode:'managed' },
  { id:'webhooks', name:'Webhooks', category:'integration', description:'Eventos e integrações HTTP', mode:'managed' },
  { id:'ai', name:'IA', category:'ai', description:'Gateway para provedores de IA', mode:'managed' },
] as const;

function id(prefix:string){ return prefix+'_'+crypto.randomUUID().replace(/-/g,'').slice(0,20); }
function keyMaterial(){
  const raw = process.env.BRISABASE_INFRA_CREDENTIALS_KEY || process.env.AUTH_ENCRYPTION_KEY || process.env.BRISABASE_OPERATIONS_TOKEN || 'development-only-change-me';
  return crypto.createHash('sha256').update(raw).digest();
}
function encrypt(value:string){
  const iv=crypto.randomBytes(12); const cipher=crypto.createCipheriv('aes-256-gcm',keyMaterial(),iv);
  const data=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]); const tag=cipher.getAuthTag();
  return [iv.toString('base64url'),tag.toString('base64url'),data.toString('base64url')].join('.');
}
function decrypt(value:string){
  const [ivB,tagB,dataB]=String(value).split('.');
  const decipher=crypto.createDecipheriv('aes-256-gcm',keyMaterial(),Buffer.from(ivB,'base64url'));
  decipher.setAuthTag(Buffer.from(tagB,'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataB,'base64url')),decipher.final()]).toString('utf8');
}
function assertView(ctx:UnifiedInfrastructureContext){ if(!VIEW.has(ctx.role)) throw new Error('Infrastructure access denied.'); }
function assertManage(ctx:UnifiedInfrastructureContext){ if(!MANAGE.has(ctx.role)) throw new Error('Infrastructure management requires admin, owner, or service role.'); }

export class UnifiedInfrastructureEngine {
  catalog(){ return SERVICES; }

  async overview(ctx:UnifiedInfrastructureContext){
    assertView(ctx);
    const [resources,deployments,providers]=await Promise.all([
      postgres.query<any>('SELECT service,status,count(*)::int AS count FROM infrastructure_resources WHERE project_id=$1 AND (environment_id=$2 OR environment_id IS NULL) GROUP BY service,status ORDER BY service',[ctx.projectId,ctx.environmentId]),
      postgres.query<any>('SELECT id,status,source,image,commit_sha,replicas,url,created_at,started_at,finished_at FROM infrastructure_deployments WHERE project_id=$1 AND (environment_id=$2 OR environment_id IS NULL) ORDER BY created_at DESC LIMIT 20',[ctx.projectId,ctx.environmentId]),
      postgres.query<any>('SELECT id,name,type,mode,region,status,metadata,created_at FROM infrastructure_providers WHERE organization_id=$1 ORDER BY created_at DESC',[ctx.organizationId]),
    ]);
    return { catalog:SERVICES, resources, deployments, providers, capabilities:{controlPlane:true,managedServices:true,byok:true,usageMetering:true,deployments:true,domains:true,backups:true,observability:true} };
  }

  async resources(ctx:UnifiedInfrastructureContext){
    assertView(ctx);
    return postgres.query<any>('SELECT r.*,p.name provider_name FROM infrastructure_resources r LEFT JOIN infrastructure_providers p ON p.id=r.provider_id WHERE r.project_id=$1 AND (r.environment_id=$2 OR r.environment_id IS NULL) ORDER BY r.created_at DESC',[ctx.projectId,ctx.environmentId]);
  }

  async activate(ctx:UnifiedInfrastructureContext,input:any){
    assertManage(ctx);
    const service=String(input.service||'').trim();
    const def=SERVICES.find(s=>s.id===service);
    if(!def) throw new Error('Unsupported infrastructure service.');
    const name=String(input.name||def.name).trim();
    const existing=await postgres.query<any>('SELECT * FROM infrastructure_resources WHERE project_id=$1 AND environment_id=$2 AND service=$3 AND status <> $4 LIMIT 1',[ctx.projectId,ctx.environmentId,service,'deleted']);
    if(existing[0]) return existing[0];
    const providerId=input.provider_id ? String(input.provider_id) : null;
    const region=String(input.region||'').trim()||null;
    const endpoint = service==='postgresql' ? process.env.DATABASE_URL||null : service==='redis' ? process.env.REDIS_URL||null : service==='storage' ? process.env.STORAGE_PUBLIC_URL||null : null;
    const status=['postgresql','redis','storage','backups','logs','monitoring','webhooks'].includes(service) ? 'active' : 'provisioning';
    const row=(await postgres.query<any>(
      `INSERT INTO infrastructure_resources(id,organization_id,project_id,environment_id,service,name,provider_id,status,plan,region,endpoint,public_url,connection,config)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id('res'),ctx.organizationId,ctx.projectId,ctx.environmentId,service,name,providerId,status,String(input.plan||'standard'),region,endpoint,service==='storage'?process.env.STORAGE_PUBLIC_URL||null:null,JSON.stringify({managed: true}),JSON.stringify(input.config||{})]
    ))[0];
    await this.audit(ctx,'service.activate','resource',row.id,{service,plan:row.plan,provider_id:providerId});
    return row;
  }

  async deactivate(ctx:UnifiedInfrastructureContext,resourceId:string){
    assertManage(ctx);
    const rows=await postgres.query<any>('UPDATE infrastructure_resources SET status=$4,updated_at=now() WHERE id=$1 AND project_id=$2 AND environment_id=$3 RETURNING *',[resourceId,ctx.projectId,ctx.environmentId,'deleted']);
    if(!rows[0]) throw new Error('Infrastructure resource not found.');
    await this.audit(ctx,'service.deactivate','resource',resourceId,{});
    return rows[0];
  }

  async providers(ctx:UnifiedInfrastructureContext){ assertView(ctx); return postgres.query<any>('SELECT id,name,type,mode,region,status,metadata,created_at,updated_at FROM infrastructure_providers WHERE organization_id=$1 ORDER BY created_at DESC',[ctx.organizationId]); }

  async addProvider(ctx:UnifiedInfrastructureContext,input:any){
    assertManage(ctx);
    const name=String(input.name||'').trim(); const type=String(input.type||'').trim();
    if(!name||!type) throw new Error('Provider name and type are required.');
    const row=(await postgres.query<any>('INSERT INTO infrastructure_providers(id,organization_id,name,type,mode,region,status,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,type,mode,region,status,metadata,created_at',[id('prv'),ctx.organizationId,name,type,String(input.mode||'byok'),input.region||null,'connected',JSON.stringify(input.metadata||{})]))[0];
    await this.audit(ctx,'provider.add','provider',row.id,{type,mode:row.mode});
    return row;
  }

  async credentials(ctx:UnifiedInfrastructureContext){
    assertView(ctx);
    return postgres.query<any>('SELECT id,name,kind,provider_id,metadata,created_at,rotated_at FROM infrastructure_credentials WHERE organization_id=$1 ORDER BY created_at DESC',[ctx.organizationId]);
  }

  async addCredential(ctx:UnifiedInfrastructureContext,input:any){
    assertManage(ctx);
    const secret=String(input.secret||'');
    if(secret.length<1) throw new Error('Credential secret is required.');
    const row=(await postgres.query<any>('INSERT INTO infrastructure_credentials(id,organization_id,provider_id,name,kind,secret_ciphertext,metadata) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,name,kind,provider_id,metadata,created_at',[id('cred'),ctx.organizationId,input.provider_id||null,String(input.name||'Credential'),String(input.kind||'api-key'),encrypt(secret),JSON.stringify(input.metadata||{})]))[0];
    await this.audit(ctx,'credential.add','credential',row.id,{kind:row.kind,provider_id:row.provider_id});
    return {...row,secret:null};
  }

  async deployments(ctx:UnifiedInfrastructureContext){ assertView(ctx); return postgres.query<any>('SELECT * FROM infrastructure_deployments WHERE project_id=$1 AND (environment_id=$2 OR environment_id IS NULL) ORDER BY created_at DESC LIMIT 100',[ctx.projectId,ctx.environmentId]); }

  async createDeployment(ctx:UnifiedInfrastructureContext,input:any){
    assertManage(ctx);
    const row=(await postgres.query<any>('INSERT INTO infrastructure_deployments(id,organization_id,project_id,environment_id,provider_id,source,image,commit_sha,status,replicas,url,created_by,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()) RETURNING *',[id('dep'),ctx.organizationId,ctx.projectId,ctx.environmentId,input.provider_id||null,String(input.source||'control-plane'),input.image||null,input.commit_sha||null,'queued',Math.max(1,Number(input.replicas||1)),input.url||null,ctx.userId]))[0];
    await this.audit(ctx,'deployment.create','deployment',row.id,{image:row.image,commit_sha:row.commit_sha,replicas:row.replicas});
    return row;
  }

  async usage(ctx:UnifiedInfrastructureContext){
    assertView(ctx);
    return postgres.query<any>('SELECT service,metric,unit,round(sum(quantity),6) quantity FROM infrastructure_usage_events WHERE organization_id=$1 AND (project_id=$2 OR project_id IS NULL) AND occurred_at >= now()-interval \'30 days\' GROUP BY service,metric,unit ORDER BY service,metric',[ctx.organizationId,ctx.projectId]);
  }

  private async audit(ctx:UnifiedInfrastructureContext,action:string,type:string,resourceId:string,metadata:any){
    await postgres.execute('INSERT INTO infrastructure_audit_events(id,organization_id,project_id,environment_id,user_id,action,resource_type,resource_id,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id('aud'),ctx.organizationId,ctx.projectId,ctx.environmentId,ctx.userId,action,type,resourceId,JSON.stringify(metadata||{})]);
  }

  async getCredentialSecret(ctx:UnifiedInfrastructureContext,credentialId:string){
    assertManage(ctx);
    const rows=await postgres.query<any>('SELECT secret_ciphertext FROM infrastructure_credentials WHERE id=$1 AND organization_id=$2',[credentialId,ctx.organizationId]);
    if(!rows[0]) throw new Error('Credential not found.');
    return decrypt(rows[0].secret_ciphertext);
  }
}
export const unifiedInfrastructureEngine=new UnifiedInfrastructureEngine();
