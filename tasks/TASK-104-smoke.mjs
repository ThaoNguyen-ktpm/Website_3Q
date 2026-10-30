// Local fixture only. No credentials, network clients, production stores or running servers are used.
import assert from 'node:assert/strict';
import {mkdtemp,readdir,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import express from '../Webstie/node_modules/express/index.js';
import {SplitStore} from '../Webstie/server/src/sale-ai/lib/split-store.js';
import {normalizeProduct} from '../Webstie/server/src/sale-ai/lib/kiot.js';
import {getMe} from '../Webstie/server/dist/controllers/authController.js';
import {requirePermission} from '../Webstie/server/dist/middlewares/requirePermission.js';
import {requireSameOrigin} from '../Webstie/server/dist/middlewares/requireSameOrigin.js';
import {errorHandler} from '../Webstie/server/dist/middlewares/errorHandler.js';
import {createSaleAiRouter} from '../Webstie/server/dist/routes/saleAiRoutes.js';

const built=process.argv.includes('--built');
const {createSaleAi}=await import(built?'../Webstie/server/dist/sale-ai/core.js':'../Webstie/server/src/sale-ai/core.js');

const dataDir=await mkdtemp(join(tmpdir(),'task104-measure-'));
const products=Array.from({length:4474},(_,i)=>normalizeProduct({id:i+1,code:`SP${String(i+1).padStart(6,'0')}`,name:`Fixture bag ${i+1}`,basePrice:35e6,
 createdDate:'2026-09-01T09:00:00',isActive:true,description:'Fixture original',inventories:[{branchId:44466,onHand:1}]}));
const sapos=products.map(p=>({id:p.id,content:'Fixture original',variants:[{id:p.id,sku:p.code,price:35e6}]}));
let writes=0;
const client={all:async()=>structuredClone(products),product:async id=>structuredClone(products[id-1]),update:async(p,b)=>{
 await new Promise(resolve=>setTimeout(resolve,5));writes++;Object.assign(products[p.id-1],{currentPrice:b.basePrice,notes:b.description});
}};
const sapoClient={all:async()=>structuredClone(sapos),product:async id=>structuredClone(sapos[id-1]),update:async(id,vid,price)=>{sapos[id-1].variants[0].price=price;}};
const sale=await createSaleAi({dataDir,fixture:true,source:{load:async()=>[]},client,sapoClient,clock:()=>new Date('2026-11-16T03:00:00Z'),
 store:new SplitStore(join(dataDir,'state.json')),liveStore:new SplitStore(join(dataDir,'kiot-state.json')),sapoStore:new SplitStore(join(dataDir,'sapo-state.json'),{kind:'sapo'})});
const timings=[];sale.live.timingSink=t=>timings.push(t);
const web=express();web.get('/api/auth/me',getMe);
let ready=false;
// Simulated authentication only; permission and origin checks are the real web middleware.
web.use('/sale-ai',(req,res,next)=>{res.locals.user={permissions:req.get('x-fixture-permission')==='yes'?['sale.manage']:[]};next();},requirePermission('sale.manage'),requireSameOrigin,createSaleAiRouter(()=>ready?sale:undefined));
web.use(errorHandler);
const server=web.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const send=(path,body)=>fetch(base+'/sale-ai'+path,{headers:{'x-fixture-permission':'yes',...(body?{'content-type':'application/json',Origin:'http://localhost:5173'}:{})},...(body?{method:'POST',body:JSON.stringify({dataset:'real',...body})}:{})});
const json=async(path,body)=>{const r=await send(path,body);const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result;};
async function size(dir){let bytes=0;for(const item of await readdir(dir,{withFileTypes:true})){const p=join(dir,item.name);bytes+=item.isDirectory()?await size(p):(await stat(p)).size;}return bytes;}
const measurements={fixture:true,builtCore:built,count:products.length,dataDir,authSession:'unauthenticated; real /api/auth/me returns 401',phases:{}};
async function measured(name,work){
 const delays=[];let active=true;
 const probe=(async()=>{while(active){const at=performance.now();const r=await fetch(base+'/api/auth/me');await r.arrayBuffer();assert.equal(r.status,401);delays.push(performance.now()-at);await new Promise(r=>setTimeout(r,5));}})();
 const at=performance.now();try{return await work();}finally{active=false;await probe;measurements.phases[name]={ms:performance.now()-at,authSamples:delays.length,authMaxMs:Math.max(...delays)};}
}
try{
 const starting=await send('/api/status');assert.equal(starting.status,503);assert.match((await starting.json()).error,/đang khởi động/);
 ready=true;
 assert.equal((await fetch(base+'/sale-ai/api/state')).status,403);
 assert.equal((await fetch(base+'/sale-ai/api/run',{method:'POST',headers:{'x-fixture-permission':'yes',Origin:'https://evil.test','content-type':'application/json'},body:'{}'})).status,403);
 assert.equal((await send('/api/manual-price',{})).status,410);
 const page=await send('/');assert.equal(page.status,200);assert.ok((await page.text()).includes('BAOQ'));
 assert.ok(page.headers.get('content-security-policy').includes("frame-ancestors 'self'"));
 const etag=page.headers.get('etag');
 assert.equal((await fetch(base+'/sale-ai/',{headers:{'x-fixture-permission':'yes','if-none-match':etag}})).status,304);
 assert.equal((await send('/api/view?dataset=real&view=history')).status,200);
 await json('/api/kiot/refresh',{});await json('/api/sapo/refresh',{});
 await measured('run',()=>json('/api/run',{}));
 measurements.bytesAfterRefreshAndRun=await size(dataDir);
 const run=sale.real.state.runs[0];assert.equal(run.rows.length,4474);
 const draft=await measured('prepare',()=>json('/api/kiot/prepare',{runId:run.id,codes:products.slice(0,50).map(p=>p.code),continueOnError:true}));
 const pending=measured('commit',()=>json('/api/kiot/commit',{id:draft.id,confirmed:true}));
 while(!sale.live.operation?.running)await new Promise(r=>setTimeout(r,1));
 assert.equal((await send('/api/kiot/refresh',{})).status,409);
 assert.equal((await send('/api/kiot/commit',{id:draft.id,confirmed:true})).status,409);
 const updated=await pending;assert.equal(updated.outcome,'success');assert.equal(writes,50);assert.equal(updated.items[0].row.price,33_400_000);
 measurements.timings=timings.map(({kind,totalMs,saveMs,publishMs})=>({kind,totalMs,saveMs,publishMs}));
 measurements.batchWrites=sale.live.batchWrites;
 measurements.bytesAfterCommit=await size(dataDir);
 const history=await json('/api/view?dataset=real&view=history');assert.equal(history.history.length,1);
 await writeFile(new URL(built?'./TASK-104-measurements-dist.json':'./TASK-104-measurements.json',import.meta.url),JSON.stringify(measurements,null,2)+'\n');
 console.log(JSON.stringify(measurements,null,2));
}finally{await new Promise(resolve=>server.close(resolve));}
