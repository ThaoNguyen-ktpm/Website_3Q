import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestApp} from './http-fixture.js';
import {POLICY} from '../lib/pricing.js';
import {viewData} from '../lib/view-data.js';
const memory=()=>({read:async()=>null,write:async()=>{}});
function fixture(count=5000){
 const products=Array.from({length:count},(_,i)=>({id:i+1,code:'DEMO'+i,name:i===4999?'Tên Chung Cuối':'Mẫu '+i,active:true,stock:1,p0:35e6,currentPrice:35e6,createdAt:'2026-10-13T12:00:00',type:'normal',notes:'',rawSource:{secret:'NEVER_SEND'}}));
 const rows=products.map(p=>({...p,status:'simulated',age:100,m:3,price:30e6,allowance:1e6,net:29e6,reasons:[],notesBefore:'Trước',notePreview:'Sau',liveBase:'PRIVATE',localKey:'PRIVATE'}));
 const items=rows.slice(0,23).map((r,i)=>({id:r.id,code:r.code,name:r.name,status:i%2?'write_failed':'done',before:{currentPrice:35e6,rawSource:{secret:'PRIVATE'}},row:r,error:i%2?'Lỗi mẫu':null}));
 return {version:1,cycleVersion:2,pricedOnly:true,policy:POLICY,dataRevision:1,products,runs:Array.from({length:17},(_,i)=>({id:'run'+i,day:'2027-01-21',at:'2027-01-21T02:00:00Z',policy:POLICY,dataRevision:1,dataset:'real',trigger:'schedule',rows})),updates:[{id:'up',at:'2027-01-21T03:00:00Z',outcome:'stopped',mode:'stop-v1',items,attempts:[{at:'2027-01-21T03:00:00Z',items:items.map(p=>({code:p.code,name:p.name,status:p.status,beforePrice:35e6,price:30e6,error:p.error}))}]}],manualEdits:[{id:'edit',code:'OLD',at:'2027-01-20',before:{price:1,allowance:2},after:{price:3,allowance:4}}],settings:{enabled:true,time:'09:00'},mapping:{verified:false,code:'DEMO4999'}};
}
test('paged view filters all rows before paging, bounds pages and omits histories/raw fields',()=>{
 const s=fixture();const meta={revision:'one',today:'2027-01-21',dataset:'real',busy:false};
 const read=q=>viewData(s,new URLSearchParams(q),meta);
 for(const size of [10,50,100]){const d=read({size,page:2});assert.equal(d.runs[0].rows.length,size);assert.equal(d.runs[0].rows[0].code,'DEMO'+size);assert.equal(d.pagination.total,5000);assert.ok(Buffer.byteLength(JSON.stringify(d))<100000);assert.doesNotMatch(JSON.stringify(d),/NEVER_SEND|PRIVATE|rawSource|localKey|liveBase/);}
 assert.equal(read({q:'tÊn chung'}).runs[0].rows[0].code,'DEMO4999');
 assert.equal(read({q:'zzz',page:500}).pagination.total,0);assert.equal(read({page:9999,size:100}).pagination.page,50);
 assert.equal(read({page:-1,size:1000}).pagination.size,10);
 assert.equal(read({run:'run16'}).runs[0].id,'run16');assert.throws(()=>read({run:'missing'}),e=>e.status===404);
 const before=Buffer.byteLength(JSON.stringify(read({})));s.runs.push(...Array.from({length:100},(_,i)=>({...s.runs[0],id:'old'+i})));meta.revision='two';assert.equal(Buffer.byteLength(JSON.stringify(read({}))),before);
 assert.equal(read({view:'settings'}).view,'results'); // the Thiết lập (schedule) page was removed 21/10/2026
 const history=read({view:'history',size:100});assert.equal(history.history.length,1);assert.equal(history.pagination.total,1);assert.ok(history.history.every(e=>e.kind==='update'));assert.equal(history.history[0].update.summary.failed,11);assert.doesNotMatch(JSON.stringify(history),/"rows"|"attempts"|"rawSource"/);
 meta.dataset='sample';assert.ok(read({view:'history'}).history.every(e=>e.kind==='simulation'));
});
test('HTTP view/detail revisions, unchanged ensure, changed dates, checkpoints, failed saves and static ETag',async()=>{
 const sample=memory(),real=memory();let external=0;
 const client=new Proxy({}, {get:()=>async()=>{external++;throw Error('No external calls');}});
 const app=await createTestApp({store:sample,liveStore:real,sapoStore:memory(),source:{load:async()=>[]},client,clock:()=>new Date('2027-01-21T04:00:00Z')});
 app.real.state=fixture(23);app.simulator.state=structuredClone(app.real.state);
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 const get=path=>fetch(base+path);const post=async(path,body={})=>(await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({dataset:'real',...body})})).json();
 try{
  const before=await (await get('/api/view?dataset=real')).json();
  const ensure=await post('/api/table/ensure');assert.equal(ensure.changed,false);assert.equal(ensure.revision,before.revision);
  app.real.state.runs[0].day='2027-01-20';const changed=await post('/api/table/ensure');assert.equal(changed.changed,true);assert.notEqual(changed.revision,before.revision);
  const current=await (await get('/api/view?dataset=real')).json();assert.equal(current.runs[0].day,'2027-01-21');
  for(const field of ['policy','dataRevision']){app.real.state.runs[0][field]=field==='policy'?'old':-1;const update=await post('/api/table/ensure');assert.equal(update.changed,true);assert.equal((await post('/api/table/ensure')).changed,false);}
  const detail=await (await get('/api/history/updates/up?dataset=real&errorsOnly=true&size=10&page=2')).json();assert.equal(detail.pagination.total,11);assert.equal(detail.pagination.items.length,1);assert.equal(detail.attempts[0].failed,11);assert.doesNotMatch(JSON.stringify(detail),/PRIVATE|rawSource/);
  const attempt=await (await get('/api/history/updates/up?dataset=real&errorsOnly=true&attempt=0')).json();assert.equal(attempt.pagination.items[0].beforePrice,35e6);
  assert.equal((await get('/api/history/updates/missing?dataset=real')).status,404);assert.equal((await get('/api/history/updates/up?dataset=real&attempt=99')).status,404);
  assert.equal((await get('/api/view?dataset=real&run=missing')).status,404);
  const rev=(await (await get('/api/status?dataset=real')).json()).revision;await app.live.checkpoint(app.real.state);const checkpoint=await (await get('/api/status?dataset=real')).json();assert.notEqual(checkpoint.revision,rev);
  real.write=async()=>{throw Error('Disk failed');};await assert.rejects(app.real.mutate(state=>{state.loadedAt='x';}),/Disk failed/);assert.equal((await (await get('/api/status?dataset=real')).json()).revision,checkpoint.revision);
  for(const path of ['/','/app.js','/style.css','/live-ui.js','/history-model.js','/update-report.js']){const first=await get(path);const etag=first.headers.get('etag');assert.ok(etag);assert.equal(first.headers.get('cache-control'),'no-cache');await first.arrayBuffer();const fresh=await fetch(base+path,{headers:{'If-None-Match':'W/'+etag}});assert.equal(fresh.status,304);assert.equal((await fresh.text()).length,0);assert.equal((await fetch(base+path,{headers:{'If-None-Match':'"old-version"'}})).status,200);}
  const legacy=await get('/api/state?dataset=real');assert.equal(legacy.headers.get('cache-control'),'no-store');assert.ok((await legacy.json()).runs[0].rows.length>10);assert.equal(external,0);
 }finally{app.server.closeAllConnections();await new Promise(r=>app.server.close(r));}
});
