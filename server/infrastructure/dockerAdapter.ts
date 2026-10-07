import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const forbiddenImageChars=new RegExp('[\\\\s;&|<>$\\"\\\\]');
function safeImage(value:string):string{const image=value.trim();if(!image||image.length>512||forbiddenImageChars.test(image))throw new Error('Invalid container image reference.');if(!/^[A-Za-z0-9][A-Za-z0-9._\\/-]*(?::[A-Za-z0-9][A-Za-z0-9._-]*)?(?:@[A-Za-z0-9:+._-]+)?$/.test(image))throw new Error('Invalid container image reference.');return image;}
function safeName(value:string):string{const name=value.trim();if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/.test(name))throw new Error('Invalid container name.');return name;}
async function docker(args:string[],timeout=120_000){if(process.env.BRISABASE_DOCKER_ENABLED!=='true')throw new Error('Docker adapter is disabled. Set BRISABASE_DOCKER_ENABLED=true on the infrastructure worker.');try{return await execFileAsync(process.env.DOCKER_BIN||'docker',args,{timeout,maxBuffer:1024*1024});}catch(error:any){const detail=String(error?.stderr||error?.message||'Docker command failed.').trim();throw new Error('Docker operation failed: '+detail.slice(0,1000));}}
export type DockerDeploymentInput={image:string;name:string;replicas?:number;port?:number;hostPort?:number;env?:Record<string,string>};
export class DockerAdapter{
async pull(image:string){return docker(['pull',safeImage(image)]);}
async inspect(name:string){try{const r=await docker(['inspect',safeName(name)]);return JSON.parse(r.stdout)[0];}catch{return null;}}
async remove(name:string){const existing=await this.inspect(name);if(existing)await docker(['rm','-f',safeName(name)]);}
async deploy(input:DockerDeploymentInput){const image=safeImage(input.image);const name=safeName(input.name);const replicas=Math.max(1,Math.min(20,Number(input.replicas||1)));if(replicas>1)throw new Error('Docker single-host adapter currently supports one replica per deployment; use the cluster adapter for replicas > 1.');await this.pull(image);await this.remove(name);const args=['run','-d','--restart','unless-stopped','--name',name];if(input.port&&input.hostPort){if(!Number.isInteger(input.port)||!Number.isInteger(input.hostPort)||input.port<1||input.port>65535||input.hostPort<1||input.hostPort>65535)throw new Error('Invalid container port.');args.push('-p',input.hostPort+':'+input.port);}for(const [key,value] of Object.entries(input.env||{})){if(!/^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(key))throw new Error('Invalid container environment variable name.');if(String(value).length>8192)throw new Error('Container environment variable is too long.');args.push('-e',key+'='+String(value));}args.push(image);const created=await docker(args);return {containerId:created.stdout.trim(),name,image,status:'running'};}
async status(name:string){const existing=await this.inspect(name);if(!existing)return {exists:false,status:'missing'};return {exists:true,status:existing.State?.Status||'unknown',containerId:existing.Id,name};}
async logs(name:string,tail=200){const result=await docker(['logs','--tail',String(Math.max(1,Math.min(1000,tail))),safeName(name)]);return result.stdout||result.stderr;}
}
export const dockerAdapter=new DockerAdapter();