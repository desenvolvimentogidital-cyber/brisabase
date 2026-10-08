export const workerAgentSource = String.raw`#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';

const execFileAsync = promisify(execFile);
const CONTROL_PLANE_URL = process.env.BRISABASE_WORKER_CONTROL_PLANE;
const WORKER_TOKEN = process.env.BRISABASE_WORKER_TOKEN;
const WORKER_ID = process.env.BRISABASE_WORKER_ID;
const DOCKER_BIN = process.env.DOCKER_BIN || 'docker';

if (!CONTROL_PLANE_URL || !WORKER_TOKEN || !WORKER_ID) {
  throw new Error('Worker configuration is incomplete.');
}
if (!/^https:\/\//i.test(CONTROL_PLANE_URL) && process.env.NODE_ENV === 'production') {
  throw new Error('Production workers require an HTTPS control plane.');
}

async function request(path, init = {}) {
  const response = await fetch(new URL(path, CONTROL_PLANE_URL), {
    ...init,
    headers: {
      accept: 'application/json',
      authorization: 'Bearer ' + WORKER_TOKEN,
      ...(init.body ? {'content-type':'application/json'} : {}),
      ...(init.headers || {}),
    },
  });
  const bodyText = await response.text();
  let body = null;
  try { body = bodyText ? JSON.parse(bodyText) : null; } catch { body = { message: bodyText.slice(0,500) }; }
  if (!response.ok) throw new Error(String(body?.error?.message || body?.message || response.statusText));
  return body;
}

async function docker(args, timeout=120000) {
  const result = await execFileAsync(DOCKER_BIN,args,{timeout,maxBuffer:1024*1024});
  return {stdout:result.stdout || '',stderr:result.stderr || ''};
}
function safeImage(value) {
  const image=String(value||'').trim();
  if (!image || image.length>512 || /[\\s;&|<>$"\\\\]/.test(image) ||
      !/^[A-Za-z0-9][A-Za-z0-9._\/-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?(?:@[A-Za-z0-9:+._-]+)?$/.test(image)) throw new Error('Invalid image reference.');
  return image;
}
function safeName(value) {
  const name=String(value||'').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/.test(name)) throw new Error('Invalid container name.');
  return name;
}
async function runJob(job) {
  const p=job.payload||{};
  if (job.kind === 'docker.deploy') {
    const image=safeImage(p.image), name=safeName(p.name);
    const replicas=Math.max(1,Math.min(20,Number(p.replicas||1)));
    if (replicas !== 1) throw new Error('Worker currently supports one replica per deployment.');
    await docker(['pull',image]);
    try { await docker(['rm','-f',name],15000); } catch {}
    const args=['run','-d','--restart','unless-stopped','--name',name];
    if (Number.isInteger(p.port) && Number.isInteger(p.hostPort)) args.push('-p',String(p.hostPort)+':'+String(p.port));
    for (const [key,value] of Object.entries(p.env||{})) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key)) throw new Error('Invalid environment variable name.');
      if (String(value).length>8192) throw new Error('Environment variable is too long.');
      args.push('-e',key+'='+String(value));
    }
    args.push(image);
    const created=await docker(args);
    return {containerId:created.stdout.trim(),name,image,status:'running'};
  }
  if (job.kind === 'docker.status') {
    const name=safeName(p.name);
    try {
      const result=await docker(['inspect',name],15000);
      const parsed=JSON.parse(result.stdout)[0];
      return {exists:true,status:parsed.State?.Status||'unknown',containerId:parsed.Id,name};
    } catch { return {exists:false,status:'missing',name}; }
  }
  if (job.kind === 'docker.logs') {
    const name=safeName(p.name);
    const tail=Math.max(1,Math.min(1000,Number(p.tail||200)));
    const result=await docker(['logs','--tail',String(tail),name],30000);
    return {name,logs:(result.stdout||result.stderr||'').slice(-20000)};
  }
  if (job.kind === 'docker.remove') {
    const name=safeName(p.name);
    try { await docker(['rm','-f',name],30000); } catch {}
    return {name,status:'removed'};
  }
  throw new Error('Unsupported worker job.');
}

async function heartbeat() {
  try { await request('/internal/infrastructure/workers/heartbeat',{method:'POST',body:JSON.stringify({worker_id:WORKER_ID,metadata:{docker:true,agent:'brisabase-worker/1'}})}); } catch (error) { console.error('[worker] heartbeat failed',error.message); }
}
async function poll() {
  try {
    const response=await request('/internal/infrastructure/workers/poll',{method:'POST',body:JSON.stringify({worker_id:WORKER_ID})});
    for (const job of response.jobs||[]) {
      try {
        const result=await runJob(job);
        await request('/internal/infrastructure/workers/jobs/'+encodeURIComponent(job.id)+'/result',{method:'POST',body:JSON.stringify({status:'completed',result,logs:JSON.stringify(result)} )});
      } catch (error) {
        await request('/internal/infrastructure/workers/jobs/'+encodeURIComponent(job.id)+'/result',{method:'POST',body:JSON.stringify({status:'failed',result:{},logs:String(error?.message||error)})}).catch(()=>{});
      }
    }
  } catch (error) { console.error('[worker] poll failed',error.message); }
}
await heartbeat();
await poll();
setInterval(heartbeat, 30000);
setInterval(poll, 5000);
`;