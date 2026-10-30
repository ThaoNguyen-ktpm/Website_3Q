// Sandbox fallback: real compiled website guards + source core; no running app or real accounts.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createSaleAi} from '../Webstie/server/src/sale-ai/core.js';
import {requirePermission} from '../Webstie/server/dist/middlewares/requirePermission.js';
import {requireSameOrigin} from '../Webstie/server/dist/middlewares/requireSameOrigin.js';
import {errorHandler} from '../Webstie/server/dist/middlewares/errorHandler.js';
import {env} from '../Webstie/server/dist/config/env.js';
const require=createRequire(new URL('../Webstie/server/package.json',import.meta.url));
const express=require('express'),request=require('supertest');
const memory=()=>{let value=null;return {read:async()=>structuredClone(value),write:async next=>{value=structuredClone(next);}};};
const forbidden=async()=>{throw Error('Unexpected external call');};
const core=await createSaleAi({fixture:true,store:memory(),liveStore:memory(),sapoStore:memory(),client:{all:forbidden},sapoClient:{configured:false,all:forbidden}});
env.APP_ORIGIN='http://localhost:8787';
const app=express();let calls=0;
app.use('/sale-ai',(req,res,next)=>{
 if(!req.get('X-Test-User'))return res.sendStatus(401);
 res.locals.user={permissions:(req.get('X-Test-Permissions')||'').split(',')};next();
},requirePermission('sale.manage'),requireSameOrigin,(req,res)=>{calls++;return core.handler(req,res);});
app.use(errorHandler);
for(const headers of [{},{'x-sale-ai-token':'fixture-token'},{'X-Test-User':'1','X-Test-Permissions':'products.view'}]) {
 const response=await request(app).get('/sale-ai/api/status').set(headers);
 assert.equal(response.status,headers['X-Test-User']?403:401);
}
assert.equal(calls,0);
const manager={'X-Test-User':'1','X-Test-Permissions':'sale.manage'};
const status=await request(app).get('/sale-ai/api/status').set(manager);
assert.equal(status.status,200);assert.equal(status.body.busy,false);
for(const path of ['/api/kiot/commit','/api/run','/api/manual-price']) {
 const response=await request(app).post('/sale-ai'+path).set(manager).set('Origin','https://foreign.example').send({confirmed:true});
 assert.equal(response.status,403);
}
assert.equal(calls,1);
const run=await request(app).post('/sale-ai/api/run').set(manager).set('Origin',env.APP_ORIGIN).send({});
assert.equal(run.status,200);assert.equal(calls,2);
console.log('PASS: 3 access denials, real core status, 3 foreign-origin denials, same-origin run. Authentication is a fixture.');
