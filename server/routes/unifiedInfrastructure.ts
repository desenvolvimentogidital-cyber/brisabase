import { Router } from 'express';
import { unifiedInfrastructureEngine, UnifiedInfrastructureContext } from '../infrastructure/unifiedInfrastructureEngine';
import { AuthenticatedRequest } from '../middleware/auth';

export const unifiedInfrastructureRouter=Router();

function ctx(req:AuthenticatedRequest):UnifiedInfrastructureContext{
  if(!req.user?.id||!req.user?.role||!req.organizationId||!req.projectId||!req.environmentId) throw new Error('Authenticated project scope is required.');
  return {organizationId:req.organizationId,projectId:req.projectId,environmentId:req.environmentId,userId:req.user.id,role:req.user.role};
}
function fail(res:any,error:any){ const message=error?.message||'Infrastructure operation failed.'; const status=/not found/i.test(message)?404:/required|unsupported|denied|invalid/i.test(message)?400:500; return res.status(status).json({error:{code:'UNIFIED_INFRASTRUCTURE_ERROR',message:status>=500&&process.env.NODE_ENV==='production'?'Infrastructure operation failed.':message}}); }

unifiedInfrastructureRouter.get('/api/control-plane/catalog',(req,res)=>res.json(unifiedInfrastructureEngine.catalog()));
unifiedInfrastructureRouter.get('/api/control-plane/overview',async(req,res)=>{try{res.json(await unifiedInfrastructureEngine.overview(ctx(req as AuthenticatedRequest)));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.get('/api/control-plane/resources',async(req,res)=>{try{res.json(await unifiedInfrastructureEngine.resources(ctx(req as AuthenticatedRequest)));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.post('/api/control-plane/resources',async(req,res)=>{try{res.status(201).json(await unifiedInfrastructureEngine.activate(ctx(req as AuthenticatedRequest),req.body||{}));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.delete('/api/control-plane/resources/:id',async(req,res)=>{try{res.json(await unifiedInfrastructureEngine.deactivate(ctx(req as AuthenticatedRequest),req.params.id));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.get('/api/control-plane/workers',async(req,res)=>{try{res.json(await unifiedInfrastructureEngine.workers(ctx(req as AuthenticatedRequest)));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.get('/api/control-plane/providers',async(req,res)=>{try{res.json(await unifiedInfrastructureEngine.providers(ctx(req as AuthenticatedRequest)));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.post('/api/control-plane/providers',async(req,res)=>{try{res.status(201).json(await unifiedInfrastructureEngine.addProvider(ctx(req as AuthenticatedRequest),req.body||{}));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.get('/api/control-plane/credentials',async(req,res)=>{try{res.json(await unifiedInfrastructureEngine.credentials(ctx(req as AuthenticatedRequest)));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.post('/api/control-plane/credentials',async(req,res)=>{try{res.status(201).json(await unifiedInfrastructureEngine.addCredential(ctx(req as AuthenticatedRequest),req.body||{}));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.get('/api/control-plane/deployments',async(req,res)=>{try{res.json(await unifiedInfrastructureEngine.deployments(ctx(req as AuthenticatedRequest)));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.post('/api/control-plane/deployments',async(req,res)=>{try{res.status(201).json(await unifiedInfrastructureEngine.createDeployment(ctx(req as AuthenticatedRequest),req.body||{}));}catch(e){fail(res,e);}});
unifiedInfrastructureRouter.get('/api/control-plane/usage',async(req,res)=>{try{res.json(await unifiedInfrastructureEngine.usage(ctx(req as AuthenticatedRequest)));}catch(e){fail(res,e);}});
