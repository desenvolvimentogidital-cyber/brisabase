import crypto from 'node:crypto';
import { Router } from 'express';
import { postgres } from '../db/postgres';
import { config } from '../config';
import { workerAgentSource } from '../infrastructure/workerAgentSource';

export const infrastructureWorkersRouter=Router();
const hash=(value:string)=>crypto.createHash('sha256').update(value).digest('hex');
const token=()=>crypto.randomBytes(32).toString('base64url');
const safeEqual=(a:string,b:string)=>{const aa=Buffer.from(a);const bb=Buffer.from(b);return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);};

async function workerFromBearer(req:any){
  const auth=String(req.headers.authorization||'');
  if(!auth.startsWith('Bearer ')) return null;
  const presented=auth.slice(7).trim();
  if(!presented) return null;
  const rows=await postgres.query<any>('SELECT * FROM infrastructure_workers WHERE token_hash=$1 LIMIT 1',[hash(presented)]);
  return rows[0]||null;
}
function fail(res:any,error:any,status=400){return res.status(status).json({error:{code:'WORKER_ERROR',message:process.env.NODE_ENV==='production'&&status>=500?'Worker operation failed.':String(error?.message||error)}});}

infrastructureWorkersRouter.post('/internal/infrastructure/workers/enroll',async(req,res)=>{
  try{
    const workerId=String(req.body?.worker_id||'');
    const enrollmentToken=String(req.body?.enrollment_token||'');
    if(!workerId||!enrollmentToken) return fail(res,new Error('Worker enrollment credentials are required.'));
    const worker=(await postgres.query<any>('SELECT * FROM infrastructure_workers WHERE id=$1 LIMIT 1',[workerId]))[0];
    if(!worker) return fail(res,new Error('Worker not found.'),404);
    if(worker.enrolled_at||worker.status==='online') return fail(res,new Error('Worker is already enrolled.'),409);
    if(!worker.enrollment_hash||!worker.enrollment_expires_at||new Date(worker.enrollment_expires_at).getTime()<Date.now()||!safeEqual(worker.enrollment_hash,hash(enrollmentToken))) return fail(res,new Error('Worker enrollment token is invalid or expired.'),401);
    const workerToken=token();
    await postgres.execute('UPDATE infrastructure_workers SET token_hash=$2,enrollment_hash=NULL,enrollment_expires_at=NULL,enrolled_at=now(),status=$3,updated_at=now() WHERE id=$1',[workerId,hash(workerToken),'online']);
    return res.json({worker_id:workerId,worker_token:workerToken,agent_url:config.publicUrl('/internal/infrastructure/workers/agent.js'),control_plane_url:config.apiUrl||config.publicUrl('/')});
  }catch(error){return fail(res,error,500);}
});

infrastructureWorkersRouter.get('/internal/infrastructure/workers/agent.js',async(req,res)=>{
  try{
    const worker=await workerFromBearer(req);
    if(!worker) return fail(res,new Error('Worker authentication required.'),401);
    res.type('application/javascript').send(workerAgentSource);
  }catch(error){return fail(res,error,500);}
});

infrastructureWorkersRouter.post('/internal/infrastructure/workers/heartbeat',async(req,res)=>{
  try{
    const worker=await workerFromBearer(req);
    if(!worker||worker.id!==String(req.body?.worker_id||'')) return fail(res,new Error('Worker authentication required.'),401);
    await postgres.execute('UPDATE infrastructure_workers SET status=$2,last_seen_at=now(),metadata=metadata || $3::jsonb,updated_at=now() WHERE id=$1',[worker.id,'online',JSON.stringify(req.body?.metadata||{})]);
    return res.json({ok:true});
  }catch(error){return fail(res,error,500);}
});

infrastructureWorkersRouter.post('/internal/infrastructure/workers/poll',async(req,res)=>{
  try{
    const worker=await workerFromBearer(req);
    if(!worker||worker.id!==String(req.body?.worker_id||'')) return fail(res,new Error('Worker authentication required.'),401);
    await postgres.execute('UPDATE infrastructure_workers SET status=$2,last_seen_at=now(),updated_at=now() WHERE id=$1',[worker.id,'online']);
    const jobs=await postgres.query<any>(
      'UPDATE infrastructure_worker_jobs SET status=$2,attempts=attempts+1,started_at=COALESCE(started_at,now()),lease_until=now()+interval \'2 minutes\' WHERE id IN (SELECT id FROM infrastructure_worker_jobs WHERE worker_id=$1 AND status=\'queued\' ORDER BY created_at LIMIT 4 FOR UPDATE SKIP LOCKED) RETURNING id,kind,payload,attempts',
      [worker.id,'running']
    );
    return res.json({jobs});
  }catch(error){return fail(res,error,500);}
});

infrastructureWorkersRouter.post('/internal/infrastructure/workers/jobs/:id/result',async(req,res)=>{
  try{
    const worker=await workerFromBearer(req);
    if(!worker) return fail(res,new Error('Worker authentication required.'),401);
    const job=(await postgres.query<any>('SELECT * FROM infrastructure_worker_jobs WHERE id=$1 AND worker_id=$2 LIMIT 1',[req.params.id,worker.id]))[0];
    if(!job) return fail(res,new Error('Worker job not found.'),404);
    const status=['completed','failed'].includes(String(req.body?.status))?String(req.body.status):'failed';
    await postgres.execute('UPDATE infrastructure_worker_jobs SET status=$2,result=$3,logs=$4,finished_at=now(),lease_until=NULL WHERE id=$1',[job.id,status,JSON.stringify(req.body?.result||{}),String(req.body?.logs||'').slice(-20000)]);
    const deploymentId=job.payload?.deploymentId;
    if(deploymentId){
      await postgres.execute('UPDATE infrastructure_deployments SET status=$2,logs=$3,finished_at=now() WHERE id=$1 AND status IN (\'queued\',\'deploying\')',[deploymentId,status==='completed'?'completed':'failed',String(req.body?.logs||'').slice(-20000)]);
    }
    return res.json({ok:true});
  }catch(error){return fail(res,error,500);}
});
