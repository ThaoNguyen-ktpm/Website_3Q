import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestApp} from './http-fixture.js';
import {KiotClient,normalizeProduct} from '../lib/kiot.js';
import {POLICY} from '../lib/pricing.js';
const memory=()=>({read:async()=>null,write:async()=>{}});
test('auth and request timings contain only safe metadata and status identifies the active real operation',async()=>{
 let unblock;const waiting=new Promise(r=>unblock=r);
 const raw={id:1,code:'A',name:'Mẫu',basePrice:35e6,createdDate:'2026-10-13T12:00:00',isActive:true,inventories:[{branchId:44466,onHand:1}],description:'PRIVATE_NOTES'};
 const client=new KiotClient({credentials:{retailer:'baoqluxury',client:'PRIVATE_CLIENT',secret:'PRIVATE_SECRET'},fetcher:async(url,options)=>{if(url.includes('/connect/token')){await waiting;return {ok:true,json:async()=>({access_token:'PRIVATE_TOKEN',expires_in:3600})};}assert.equal(options.method,'GET');return {ok:true,json:async()=>raw};}});
 const app=await createTestApp({store:memory(),liveStore:memory(),sapoStore:memory(),source:{load:async()=>[]},client,clock:()=>new Date('2027-01-21T04:00:00Z')});app.live.timingSink=()=>{};
 // Isolated legacy auth-timing fixture, with fetcher already stubbed above.
 app.live.sapo=null;app.live.requireJoint=false;
 app.real.state={version:1,cycleVersion:2,policy:POLICY,products:[{...normalizeProduct(raw),p0:35e6,type:'normal'}],runs:[],updates:[],prepared:[],mapping:{verified:true},dataRevision:1};
 await app.real.run();await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const prepared=app.live.prepare(app.real.state.runs[0].id,['A']);await new Promise(r=>setImmediate(r));
  const status=await(await fetch(base+'/api/status?dataset=real')).json();assert.equal(status.busy,true);assert.equal(status.operation.source,'real');assert.equal(status.operation.total,1);
  unblock();const result=await prepared;assert.ok(result.timings.authMs>0);assert.equal(result.timings.requests.length,1);assert.ok(result.timings.saveMs>=0);
  assert.doesNotMatch(JSON.stringify(result.timings),/PRIVATE/);assert.doesNotMatch(JSON.stringify(app.live.lastTimings),/PRIVATE/);
  assert.equal(app.live.operation.running,false);
 }finally{unblock();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));}
});
