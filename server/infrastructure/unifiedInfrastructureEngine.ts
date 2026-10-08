import crypto from 'node:crypto';
import { postgres } from '../db/postgres';
import { realProjectDatabase } from '../db/realProjectDatabase';
import { realStorageEngine } from '../storage/realStorageEngine';
import { redisClient } from '../redis';
import { dockerAdapter } from './dockerAdapter';
import { hostingEngine } from '../platform/hostingEngine';
import { config } from '../config';
import { observability } from '../observability';

const PROVIDER_CAPABILITIES: Record<string,{services:string[];deployment:boolean;provisioning:boolean;requiresCredential:boolean}> = {
  docker:{services:['containers','deploy'],deployment:true,provisioning:true,requiresCredential:false},
  hetzner:{services:['containers','deploy'],deployment:true,provisioning:true,requiresCredential:true},
  aws:{services:['containers','postgresql','redis','storage','deploy','domains'],deployment:false,provisioning:false,requiresCredential:true},
  neon:{services:['postgresql'],deployment:false,provisioning:true,requiresCredential:true},
  s3:{services:['storage'],deployment:false,provisioning:false,requiresCredential:true},
  custom:{services:['containers','postgresql','redis','storage','deploy'],deployment:false,provisioning:false,requiresCredential:true},
  logical:{services:['postgresql','redis','storage','containers','deploy','domains','backups','logs','monitoring'],deployment:true,provisioning:false,requiresCredential:false},
};

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
function publicResource(row:any){
  if(!row) return row;
  const {connection_secret_ciphertext: _secret, ...safe}=row;
  return safe;
}

async function hetznerRequest(path:string,apiToken:string,init:RequestInit = {}):Promise<any>{
  const response=await fetch('https://api.hetzner.cloud/v1'+path,{...init,headers:{accept:'application/json',authorization:'Bearer '+apiToken,...(init.body?{'content-type':'application/json'}:{}),...(init.headers||{})}});
  const bodyText=await response.text(); let body:any=null;
  try{body=bodyText?JSON.parse(bodyText):null;}catch{body={message:bodyText.slice(0,500)};}
  if(!response.ok) throw new Error('Hetzner API '+response.status+': '+String(body?.error?.message||body?.message||response.statusText));
  return body;
}

function hetznerWorkerUserData(input:{workerId:string;enrollmentToken:string;controlPlaneUrl:string}):string {
  const q=(v:string)=>v.replace(/'/g,"'\\''");
  return '#cloud-config\npackage_update: true\npackages:\n  - ca-certificates\n  - curl\n  - jq\nruncmd:\n  - [ bash, -lc, "install -d -m 0750 /etc/brisabase-worker" ]\n  - [ bash, -lc, "curl -fsSL https://get.docker.com | sh" ]\n  - [ bash, -lc, "systemctl enable --now docker" ]\n  - [ bash, -lc, "TOKEN='+q(input.enrollmentToken)+'; WORKER_ID='+q(input.workerId)+'; CONTROL='+q(input.controlPlaneUrl)+'; curl -fsS --retry 5 -X POST -H \\\"Content-Type: application/json\\\" -d \\\"{\\\\\\\"worker_id\\\\\\\":\\\\\\\"$WORKER_ID\\\\\\\",\\\\\\\"enrollment_token\\\\\\\":\\\\\\\"$TOKEN\\\\\\\"}\\\" \\\"$CONTROL/internal/infrastructure/workers/enroll\\\" -o /etc/brisabase-worker/enrollment.json; jq -e .worker_token /etc/brisabase-worker/enrollment.json >/dev/null; jq -r .worker_token /etc/brisabase-worker/enrollment.json > /etc/brisabase-worker/token; jq -r .agent_url /etc/brisabase-worker/enrollment.json > /etc/brisabase-worker/agent_url; jq -r .control_plane_url /etc/brisabase-worker/enrollment.json > /etc/brisabase-worker/control_plane_url; chmod 0600 /etc/brisabase-worker/token /etc/brisabase-worker/enrollment.json; curl -fsS -H \\\"Authorization: Bearer $(cat /etc/brisabase-worker/token)\\\" \\\"$(cat /etc/brisabase-worker/agent_url)\\\" -o /etc/brisabase-worker/agent.mjs; cat > /etc/systemd/system/brisabase-worker.service <<\\\"UNIT\\\"\\n[Unit]\\nAfter=docker.service network-online.target\\nWants=network-online.target\\n[Service]\\nType=simple\\nEnvironment=NODE_ENV=production\\nEnvironment=BRISABASE_WORKER_ID=$WORKER_ID\\nExecStart=/bin/bash -lc \\\"export BRISABASE_WORKER_TOKEN=\\$(cat /etc/brisabase-worker/token); export BRISABASE_WORKER_CONTROL_PLANE=\\$(cat /etc/brisabase-worker/control_plane_url); exec /usr/bin/node /etc/brisabase-worker/agent.mjs\\\"\\nRestart=always\\nRestartSec=5\\n[Install]\\nWantedBy=multi-user.target\\nUNIT\\n systemctl daemon-reload; systemctl enable --now brisabase-worker" ]\n';
}

async function provisionHetznerServer(input:{apiToken:string;name:string;location?:string|null;serverType?:string|null;image?:string|null;sshKeyIds?:Array<string|number>;labels?:Record<string,string>;userData?:string}):Promise<{serverId:number;name:string;ipv4:string|null;ipv6:string|null;location:string|null;serverType:string}> {
  if(!input.apiToken) throw new Error('Hetzner API credential is required.');
  const name=input.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,63)||'brisabase-worker';
  const location=input.location||'fsn1'; const serverType=input.serverType||'cx23'; const image=input.image||'ubuntu-24.04';
  if(!input.sshKeyIds?.length) throw new Error('Hetzner provisioning requires at least one SSH key ID.');
  const payload:any={name,server_type:serverType,image,location,user_data:input.userData||'',labels:input.labels||{managed_by:'brisabase',product:'control-plane',worker:'brisabase-docker'}};
  payload.ssh_keys=input.sshKeyIds.map(String);
  const result=await hetznerRequest('/servers',input.apiToken,{method:'POST',body:JSON.stringify(payload)});
  const server=result?.server;
  if(!server?.id) throw new Error('Hetzner server was created but no server id was returned.');
  return {serverId:Number(server.id),name:server.name,ipv4:server.public_net?.ipv4?.ip||null,ipv6:server.public_net?.ipv6?.ip||null,location:server.datacenter?.location?.name||location,serverType:server.server_type?.name||serverType};
}

async function deleteHetznerServer(apiToken:string,serverId:number):Promise<void>{
  if(!apiToken||!Number.isFinite(serverId)) return;
  await hetznerRequest('/servers/'+encodeURIComponent(String(serverId)),apiToken,{method:'DELETE'});
}

async function neonRequest(path:string, apiKey:string, init:RequestInit = {}):Promise<any>{
  const response=await fetch('https://console.neon.tech/api/v2'+path, {
    ...init,
    headers:{accept:'application/json',authorization:'Bearer '+apiKey,...(init.body?{'content-type':'application/json'}:{}),...(init.headers||{})},
  });
  const bodyText=await response.text();
  let body:any=null;
  try{ body=bodyText?JSON.parse(bodyText):null; }catch{ body={message:bodyText.slice(0,500)}; }
  if(!response.ok) throw new Error('Neon API '+response.status+': '+String(body?.message||body?.error||response.statusText));
  return body;
}

function neonConnection(payload:any):string|null{
  return payload?.connection_uris?.[0]?.connection_uri || payload?.connection_uri || null;
}

async function provisionNeonPostgres(input:{apiKey:string;name:string;region?:string|null;projectId?:string|null;orgId?:string|null;branchName:string}){
  if(!input.apiKey) throw new Error('Neon API credential is required.');
  const safeName=input.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,80)||'brisabase';
  let projectId=input.projectId||null;
  let projectPayload:any=null;
  if(!projectId){
    if(!input.orgId) throw new Error('Neon provider requires metadata.org_id or metadata.project_id.');
    projectPayload=await neonRequest('/projects',input.apiKey,{method:'POST',body:JSON.stringify({project:{name:safeName,org_id:input.orgId,region_id:input.region||'aws-us-east-2',pg_version:16}})});
    projectId=projectPayload?.project?.id||projectPayload?.id||null;
    if(!projectId) throw new Error('Neon project was created but no project id was returned.');
  }
  const branchName=input.branchName.replace(/[^a-zA-Z0-9._/-]/g,'-').slice(0,100);
  const branchPayload=await neonRequest('/projects/'+encodeURIComponent(projectId)+'/branches',input.apiKey,{method:'POST',body:JSON.stringify({endpoints:[{type:'read_write'}],branch:{name:branchName}})});
  const branchId=branchPayload?.branch?.id||branchPayload?.id||null;
  let connectionString=neonConnection(branchPayload)||neonConnection(projectPayload);
  if(!connectionString&&branchId){
    const uriPayload=await neonRequest('/projects/'+encodeURIComponent(projectId)+'/connection_uri?database_name=neondb&role_name=neondb_owner&branch_id='+encodeURIComponent(branchId),input.apiKey);
    connectionString=neonConnection(uriPayload);
  }
  if(!connectionString) throw new Error('Neon provisioning completed but no connection string was returned.');
  return {projectId,branchId,connectionString,region:input.region||projectPayload?.project?.region_id||null};
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
  catalog(){ return SERVICES.map(service => ({...service, providers:Object.entries(PROVIDER_CAPABILITIES).filter(([,cap])=>cap.services.includes(service.id)).map(([type])=>type)})); }

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
    const rows=await postgres.query<any>('SELECT r.id,r.organization_id,r.project_id,r.environment_id,r.service,r.name,r.provider_id,r.status,r.plan,r.region,r.endpoint,r.public_url,r.connection,r.config,r.created_at,r.updated_at,p.name provider_name FROM infrastructure_resources r LEFT JOIN infrastructure_providers p ON p.id=r.provider_id WHERE r.project_id=$1 AND (r.environment_id=$2 OR r.environment_id IS NULL) ORDER BY r.created_at DESC',[ctx.projectId,ctx.environmentId]);
    return rows.map(publicResource);
  }

  private async recordUsage(ctx:UnifiedInfrastructureContext, service:string, metric:string, quantity:number, unit:string, metadata:any = {}): Promise<void> {
    if (!Number.isFinite(quantity) || quantity === 0) return;
    await postgres.execute(
      'INSERT INTO infrastructure_usage_events(id,organization_id,project_id,environment_id,service,metric,quantity,unit,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      [id('use'),ctx.organizationId,ctx.projectId,ctx.environmentId,service,metric,quantity,unit,JSON.stringify(metadata || {})],
    );
  }

  async activate(ctx:UnifiedInfrastructureContext,input:any){
    assertManage(ctx);
    const service=String(input.service||'').trim();
    const def=SERVICES.find(s=>s.id===service);
    if(!def) throw new Error('Unsupported infrastructure service.');
    const name=String(input.name||def.name).trim();
    const existing=await postgres.query<any>('SELECT * FROM infrastructure_resources WHERE project_id=$1 AND environment_id=$2 AND service=$3 AND status <> $4 LIMIT 1',[ctx.projectId,ctx.environmentId,service,'deleted']);
    if(existing[0]) return publicResource(existing[0]);
    const providerId=input.provider_id ? String(input.provider_id) : null;
    let providerRecord:any=null;
    let providerCredentialSecret:string|null=null;
    if (providerId) {
      const provider = (await postgres.query<any>('SELECT id,type,status,region,metadata FROM infrastructure_providers WHERE id=$1 AND organization_id=$2',[providerId,ctx.organizationId]))[0];
      if (!provider) throw new Error('Infrastructure provider not found.');
      providerRecord=provider;
      const capability = PROVIDER_CAPABILITIES[provider.type];
      if (!capability || !capability.services.includes(service)) throw new Error(`Provider '${provider.type}' does not support service '${service}'.`);
      if (capability.requiresCredential) {
        const credential = (await postgres.query<any>('SELECT id FROM infrastructure_credentials WHERE provider_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 1',[providerId,ctx.organizationId]))[0];
        if (!credential) throw new Error(`Provider '${provider.type}' requires a credential before it can be used.`);
        providerCredentialSecret=await this.getCredentialSecret(ctx,credential.id);
      }
    }
    const region=String(input.region||'').trim()||null;
    const endpoint = service==='postgresql' ? process.env.DATABASE_URL||null : service==='redis' ? process.env.REDIS_URL||null : service==='storage' ? process.env.STORAGE_PUBLIC_URL||null : null;
    const status='provisioning';
    const row=(await postgres.query<any>(
      `INSERT INTO infrastructure_resources(id,organization_id,project_id,environment_id,service,name,provider_id,status,plan,region,endpoint,public_url,connection,config)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [id('res'),ctx.organizationId,ctx.projectId,ctx.environmentId,service,name,providerId,status,String(input.plan||'standard'),region,endpoint,service==='storage'?process.env.STORAGE_PUBLIC_URL||null:null,JSON.stringify({managed: true}),JSON.stringify(input.config||{})]
    ))[0];
    try {
      let provisionedConfig:any = { managed: true, provider: providerId };
      let provisionedEndpoint = endpoint;
      if (service === 'postgresql') {
        if (providerRecord?.type === 'neon') {
          const metadata=providerRecord.metadata||{};
          const neon=await provisionNeonPostgres({apiKey:providerCredentialSecret||'',name:name+'-'+ctx.environmentId,region:region||providerRecord.region||null,projectId:metadata.project_id||null,orgId:metadata.org_id||null,branchName:'brisabase/'+ctx.projectId+'/'+ctx.environmentId});
          provisionedEndpoint=neon.connectionString.replace(/:\/\/([^:@]+):([^@]+)@/,'://$1:***@');
          provisionedConfig={managed:true,isolation:'neon-branch',provider:providerId,projectId:neon.projectId,branchId:neon.branchId,region:neon.region,external:true};
          const updatedRaw=(await postgres.query<any>('UPDATE infrastructure_resources SET status=\'active\',endpoint=$2,connection=$3,connection_secret_ciphertext=$4,config=$5,updated_at=now() WHERE id=$1 RETURNING *',[row.id,provisionedEndpoint,JSON.stringify({provider:'neon',external:true}),encrypt(neon.connectionString),JSON.stringify(provisionedConfig)]))[0];
          await this.recordUsage(ctx,service,'activation',1,'resource',{resourceId:row.id,providerId,external:true});
          await this.audit(ctx,'service.activate','resource',row.id,{service,plan:row.plan,provider_id:providerId,provisioned:true,external:true,projectId:neon.projectId,branchId:neon.branchId});
          return publicResource(updatedRaw);
        }
        const schema = await realProjectDatabase.getSchemaName(ctx);
        provisionedConfig = { managed: true, isolation: 'schema-per-environment', schema, provider: providerId };
      } else if (service === 'containers') {
        if (providerRecord?.type === 'hetzner') {
          const metadata=providerRecord.metadata||{};
          const workerId=id('wrk');
          const enrollmentToken=crypto.randomBytes(32).toString('base64url');
          const enrollmentExpires=new Date(Date.now()+15*60*1000);
          const controlPlaneUrl=config.apiUrl || config.appUrl;
          const server=await provisionHetznerServer({
            apiToken:providerCredentialSecret||'', name:name+'-'+ctx.environmentId,
            userData:hetznerWorkerUserData({workerId,enrollmentToken,controlPlaneUrl}),
            location:region||providerRecord.region||metadata.location||null,
            serverType:metadata.server_type||'cx23', image:metadata.image||'ubuntu-24.04',
            sshKeyIds:Array.isArray(metadata.ssh_key_ids)?metadata.ssh_key_ids:[],
            labels:{managed_by:'brisabase',organization_id:ctx.organizationId,project_id:ctx.projectId,environment_id:ctx.environmentId,service:'containers'},
          });
          provisionedEndpoint=server.ipv4?'http://'+server.ipv4:null;
          provisionedConfig={managed:true,isolation:'dedicated-vps',provider:providerId,external:true,serverId:server.serverId,serverName:server.name,ipv4:server.ipv4,ipv6:server.ipv6,location:server.location,serverType:server.serverType,workerBootstrap:'cloud-init-docker-agent',workerStatus:'pending',workerId};
                    await postgres.execute('INSERT INTO infrastructure_workers(id,organization_id,project_id,environment_id,resource_id,name,status,endpoint,enrollment_hash,enrollment_expires_at,metadata) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
            [workerId,ctx.organizationId,ctx.projectId,ctx.environmentId,row.id,server.name,'pending',server.ipv4?'http://'+server.ipv4:null,crypto.createHash('sha256').update(enrollmentToken).digest('hex'),enrollmentExpires,JSON.stringify({provider:'hetzner',serverId:server.serverId,dockerBootstrap:'cloud-init',enrollment:'one-time',enrollmentExpiresAt:enrollmentExpires.toISOString()})]);
          // The bootstrap token is intentionally one-time and expires after 15 minutes.
        } else {
          provisionedConfig={managed:true,provider:providerId,isolation:'container-runtime'};
        }
      } else if (service === 'redis') {
        const health = await redisClient.healthCheck();
        if (health.status !== 'ok') throw new Error('Redis is unavailable for this environment.');
        provisionedConfig = { managed: true, isolation: 'instance-prefix', prefix: process.env.BRISABASE_REDIS_PREFIX || 'brisabase', provider: providerId };
      } else if (service === 'storage') {
        const bucketName = String(input.bucket_name || `bb-${ctx.projectId}-${ctx.environmentId}`).toLowerCase().replace(/[^a-z0-9.-]/g,'-').slice(0,63);
        const bucket = await realStorageEngine.createBucket({ ...ctx, role: ctx.role }, { name: bucketName, isPublic: Boolean(input.is_public), versioningEnabled: Boolean(input.versioning_enabled) });
        provisionedConfig = { managed: true, isolation: 'bucket-per-environment', bucketId: bucket.id, bucketName, provider: providerId };
        provisionedEndpoint = process.env.STORAGE_PUBLIC_URL || null;
      } else if (service === 'backups') {
        if (!config.backup.enabled) throw new Error('Backups are disabled in this BrisaBase instance.');
        provisionedConfig = { managed: true, provider: providerId, engine: 'embedded-backup' };
      } else if (service === 'logs' || service === 'monitoring') {
        const health = await observability.checkHealth();
        provisionedConfig = { managed: true, provider: providerId, health, retention: observability.retention.get() };
      } else if (service === 'domains') {
        const site = await hostingEngine.createSite({ ...ctx, requestId: undefined }, { name: name || 'App' });
        provisionedConfig = { managed: true, provider: providerId, siteId: site.id, siteSlug: site.slug, builtInUrl: site.builtInUrl, customDomains: true };
        const hostnameInput = String(input.hostname || '').trim();
        if (hostnameInput) {
          const domain = await hostingEngine.addDomain({ ...ctx, requestId: undefined }, site.id, hostnameInput);
          provisionedConfig.domain = domain;
          provisionedEndpoint = domain?.hostname ? `https://${domain.hostname}` : site.builtInUrl;
        }
      } else if (service === 'deploy') {
        const site = await hostingEngine.createSite({ ...ctx, requestId: undefined }, { name: name || 'App' });
        provisionedConfig = { managed: true, provider: providerId, siteId: site.id, siteSlug: site.slug, builtInUrl: site.builtInUrl };
        provisionedEndpoint = site.builtInUrl;
      }
      const updated=(await postgres.query<any>(`UPDATE infrastructure_resources SET status='active',endpoint=$2,config=$3,updated_at=now() WHERE id=$1 RETURNING *`,[row.id,provisionedEndpoint,JSON.stringify(provisionedConfig)]))[0];
      await this.recordUsage(ctx,service,'activation',1,'resource',{resourceId:row.id,providerId});
      await this.audit(ctx,'service.activate','resource',row.id,{service,plan:row.plan,provider_id:providerId,provisioned:true,config:provisionedConfig});
      return publicResource(updated);
    } catch (error:any) {
      const failed=(await postgres.query<any>(`UPDATE infrastructure_resources SET status='failed',config=$2,updated_at=now() WHERE id=$1 RETURNING *`,[row.id,JSON.stringify({managed:true,error:String(error?.message||error)})]))[0];
      await this.audit(ctx,'service.activate.failed','resource',row.id,{service,error:String(error?.message||error)});
      throw error;
    }
  }

  async deactivate(ctx:UnifiedInfrastructureContext,resourceId:string){
    assertManage(ctx);
    const current=(await postgres.query<any>('SELECT * FROM infrastructure_resources WHERE id=$1 AND project_id=$2 AND environment_id=$3',[resourceId,ctx.projectId,ctx.environmentId]))[0];
    if(!current) throw new Error('Infrastructure resource not found.');
    try {
      const cfg=current.config||{};
      if(current.service==='containers' && cfg.provider && cfg.serverId){
        const provider=(await postgres.query<any>('SELECT id,type FROM infrastructure_providers WHERE id=$1 AND organization_id=$2',[cfg.provider,ctx.organizationId]))[0];
        if(provider?.type==='hetzner'){
          const credential=(await postgres.query<any>('SELECT id FROM infrastructure_credentials WHERE provider_id=$1 AND organization_id=$2 ORDER BY created_at DESC LIMIT 1',[provider.id,ctx.organizationId]))[0];
          if(credential) await deleteHetznerServer(await this.getCredentialSecret(ctx,credential.id),Number(cfg.serverId));
        }
      }
      const rows=await postgres.query<any>('UPDATE infrastructure_resources SET status=$2,updated_at=now() WHERE id=$1 RETURNING *',[resourceId,'deleted']);
      await this.audit(ctx,'service.deactivate','resource',resourceId,{provider:cfg.provider||null,serverId:cfg.serverId||null});
      return publicResource(rows[0]);
    } catch(error:any) {
      await this.audit(ctx,'service.deactivate.failed','resource',resourceId,{error:String(error?.message||error)});
      throw error;
    }
  }

  async workers(ctx:UnifiedInfrastructureContext){
    assertView(ctx);
    return postgres.query<any>('SELECT id,name,status,endpoint,resource_id,last_seen_at,metadata,created_at,updated_at FROM infrastructure_workers WHERE project_id=$1 AND (environment_id=$2 OR environment_id IS NULL) ORDER BY created_at DESC',[ctx.projectId,ctx.environmentId]);
  }

  async providers(ctx:UnifiedInfrastructureContext){ assertView(ctx); return postgres.query<any>('SELECT id,name,type,mode,region,status,metadata,created_at,updated_at FROM infrastructure_providers WHERE organization_id=$1 ORDER BY created_at DESC',[ctx.organizationId]); }

  async addProvider(ctx:UnifiedInfrastructureContext,input:any){
    assertManage(ctx);
    const name=String(input.name||'').trim(); const type=String(input.type||'').trim();
    const allowed=['docker','hetzner','aws','neon','s3','custom','logical'];
    if(!name||!type) throw new Error('Provider name and type are required.');
    if(!allowed.includes(type)) throw new Error('Unsupported infrastructure provider type.');
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
    const provider=String(input.provider||'docker');
    const capability=PROVIDER_CAPABILITIES[provider];
    if(!capability || !capability.deployment) throw new Error(`Provider '${provider}' does not have an active deployment adapter.`);
    const image=input.image?String(input.image):'';
    const name=String(input.name||('bb-'+ctx.projectId+'-'+ctx.environmentId)).replace(/[^a-zA-Z0-9_.-]/g,'-').slice(0,63);
    const replicas=Math.max(1,Number(input.replicas||1));
    const row=(await postgres.query<any>('INSERT INTO infrastructure_deployments(id,organization_id,project_id,environment_id,provider_id,source,image,commit_sha,status,replicas,url,created_by,started_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now()) RETURNING *',[id('dep'),ctx.organizationId,ctx.projectId,ctx.environmentId,input.provider_id||null,String(input.source||'control-plane'),image||null,input.commit_sha||null,'deploying',replicas,input.url||null,ctx.userId]))[0];
    try {
      let result:any={provider,status:'accepted'};
      if(provider==='hetzner') {
        if(!image) throw new Error('Hetzner deployments require an image.');
        const worker=(await postgres.query<any>('SELECT id FROM infrastructure_workers WHERE project_id=$1 AND environment_id=$2 AND status=\'online\' ORDER BY last_seen_at DESC NULLS LAST LIMIT 1',[ctx.projectId,ctx.environmentId]))[0];
        if(!worker) throw new Error('No online infrastructure worker is available for this environment.');
        const jobId=id('job');
        await postgres.execute('INSERT INTO infrastructure_worker_jobs(id,worker_id,organization_id,project_id,environment_id,kind,payload,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
          [jobId,worker.id,ctx.organizationId,ctx.projectId,ctx.environmentId,'docker.deploy',JSON.stringify({deploymentId:row.id,image,name,replicas,port:input.port?Number(input.port):undefined,hostPort:input.hostPort?Number(input.hostPort):undefined,env:input.env&&typeof input.env==='object'?input.env:{}}),'queued']);
        const updated=await postgres.query<any>('UPDATE infrastructure_deployments SET status=\'queued\' WHERE id=$1 RETURNING *',[row.id]);
        await this.audit(ctx,'deployment.queued','deployment',row.id,{provider,workerId:worker.id,jobId});
        return updated[0];
      }
      if(provider==='docker') {
        if(!image) throw new Error('Docker deployments require an image.');
        if(process.env.BRISABASE_DOCKER_ENABLED!=='true') throw new Error('Docker deployment adapter is disabled. Enable it only on a dedicated infrastructure worker.');
        result=await dockerAdapter.deploy({image,name,replicas,port:input.port?Number(input.port):undefined,hostPort:input.hostPort?Number(input.hostPort):undefined,env:input.env&&typeof input.env==='object'?input.env:{}});
      } else if(provider!=='logical') throw new Error('Unsupported deployment provider.');
      const updated=(await postgres.query<any>('UPDATE infrastructure_deployments SET status=$2,logs=$3,finished_at=now() WHERE id=$1 RETURNING *',[row.id,'completed',JSON.stringify(result)]))[0];
      await this.recordUsage(ctx,'deploy','deployment',1,'deployment',{deploymentId:row.id,provider});
      if (provider === 'docker') await this.recordUsage(ctx,'containers','container_deployment',replicas,'container',{deploymentId:row.id});
      await this.audit(ctx,'deployment.completed','deployment',row.id,{provider,result}); return updated;
    } catch(error:any) {
      const updated=(await postgres.query<any>('UPDATE infrastructure_deployments SET status=$2,logs=$3,finished_at=now() WHERE id=$1 RETURNING *',[row.id,'failed',String(error?.message||error)]))[0];
      await this.audit(ctx,'deployment.failed','deployment',row.id,{provider,error:String(error?.message||error)}); return updated;
    }
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
