import test from 'node:test';
import assert from 'node:assert/strict';
import {viewData} from '../lib/view-data.js';
import {createTestApp} from './http-fixture.js';
import {POLICY} from '../lib/pricing.js';
const memory=()=>({read:async()=>null,write:async()=>{}});
const rows=()=>Array.from({length:148},(_,i)=>({id:i,code:'P'+i,name:i%2?'Dior':'Gucci',m:i===147?null:Math.floor(i/21),age:0,status:i%7===0?'waiting':'simulated',reasons:[],p0:35e6}));
const fixture=()=>({policy:POLICY,dataRevision:1,products:[],settings:{enabled:false},runs:[{id:'run',day:'2026-10-14',policy:POLICY,dataRevision:1,dataset:'real',rows:rows()}]});
const meta={revision:'one',today:'2026-10-14',dataset:'real',busy:false};
test('M filtering runs before pagination for every M and leaves null M in all only',()=>{
 const state=fixture();const read=params=>viewData(state,new URLSearchParams(params),meta);
 assert.equal(read({}).pagination.total,148);
 for(let m=0;m<=6;m++){
  const v=read({m:String(m),page:'2',size:'10'});assert.equal(v.pagination.total,21);assert.equal(v.pagination.totalPages,3);assert.equal(v.runs[0].rows.length,10);
  assert.equal(v.runs[0].rows[0].code,'P'+(m*21+10));assert.ok(v.runs[0].rows.every(r=>r.m===m));assert.equal(v.mFilter,m);
 }
 assert.equal(read({m:'1',q:'dIoR'}).pagination.total,11);
 const empty=read({m:'1',q:'missing',page:'9'});assert.equal(empty.pagination.total,0);assert.equal(empty.pagination.page,1);assert.deepEqual(empty.runs[0].rows,[]);
});
test('M API accepts only absent or exactly one digit 0 through 6',()=>{
 for(const m of ['','-1','7','01','1.0','null','all',' 1 ']){
  assert.throws(()=>viewData(fixture(),new URLSearchParams({m}),meta),e=>e.status===400);
 }
});
test('HTTP table and select-all share M+query filtering; invalid M never selects or writes',async()=>{
 let calls=0;const client=new Proxy({}, {get:()=>async()=>{calls++;throw Error('No external calls');}});
 const app=await createTestApp({store:memory(),liveStore:memory(),sapoStore:memory(),source:{load:async()=>[]},client,clock:()=>new Date('2026-10-14T03:00:00Z')});
 app.real.state=fixture();await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+app.server.address().port;
 try{
  const table=await (await fetch(base+'/api/view?dataset=real&m=1&q=dior&size=100')).json();assert.equal(table.pagination.total,11);
  const selection=await (await fetch(base+'/api/kiot/selection?runId=run&m=1&q=dior')).json();
  assert.deepEqual(selection.codes,['P23','P25','P27','P29','P31','P33','P37','P39','P41']);
  assert.deepEqual(selection.excludedCodes,['P21','P35']);
  for(const m of ['','-1','7','01','bad'])for(const path of ['/api/view?dataset=real','/api/kiot/selection?runId=run'])assert.equal((await fetch(base+path+'&m='+m)).status,400);
  assert.equal(calls,0);assert.equal(app.real.state.runs[0].rows.length,148);
 }finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));}
});
