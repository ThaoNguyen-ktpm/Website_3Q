import test from 'node:test';
import assert from 'node:assert/strict';
import {createTestApp} from './http-fixture.js';
import {normalizeProduct} from '../lib/kiot.js';
const memory=()=>{let s=null;return {read:async()=>structuredClone(s),write:async value=>{s=structuredClone(value);}};};

test('commit never reloads or recalculates table; manual reload remains available; retry disabled',async()=>{
  const row=normalizeProduct({id:1,code:'WRITE-1',name:'Mẫu',basePrice:35e6,isActive:true,createdDate:'2026-12-03',inventories:[{branchId:44466,onHand:1}],description:''});
  let reads=0,failNote=true,failReload=false;
  const client={all:async()=>{reads++;if(failReload)throw Error('Lỗi tải danh sách');return [structuredClone(row)];},product:async()=>structuredClone(row),update:async(p,v)=>{if(failNote)throw Error('Lỗi ghi chú');if('basePrice' in v)row.currentPrice=v.basePrice;if('description' in v)row.notes=v.description;},price:async(p,v)=>{row.currentPrice=v;},note:async(p,v)=>{if(failNote)throw Error('Lỗi ghi chú');row.notes=v;}};
  const app=await createTestApp({store:memory(),liveStore:memory(),client,clock:()=>new Date('2027-01-20T03:00:00Z')});
  // Legacy Kiot-only compatibility fixture; production remains fail-closed.
  app.live.sapo=null;app.live.requireJoint=false;
  assert.equal(reads,0);await app.refreshTable();app.real.state.mapping={verified:true};
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
  const post=async(path,body)=>{const res=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)});assert.equal(res.status,200);return res.json();};
  try {
    const proposal=await app.live.prepare(app.real.state.runs[0].id,['WRITE-1']);
    const runBefore=structuredClone(app.real.state.runs[0]);
    const partial=await post('/api/kiot/commit',{id:proposal.id,confirmed:true});assert.equal(partial.summary.failed,1);assert.equal(reads,1);assert.deepEqual(app.real.state.runs[0],runBefore);
    const disabled=await fetch(base+'/api/kiot/retry',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:'{}'});assert.equal(disabled.status,410);
    failNote=false;const next=await app.live.prepare(app.real.state.runs[0].id,['WRITE-1']);const complete=await post('/api/kiot/commit',{id:next.id,confirmed:true});assert.equal(complete.summary.succeeded,1);assert.equal(reads,1);assert.deepEqual(app.real.state.runs[0],runBefore);
    await app.keepCurrent();assert.deepEqual(app.real.state.runs[0],runBefore);assert.equal(reads,1);
    await assert.rejects(app.live.prepare(app.real.state.runs[0].id,['WRITE-1']),/Kiot đã thay đổi/);
    await post('/api/kiot/refresh',{});assert.equal(reads,2);assert.equal(app.real.state.runs[0].rows[0].currentPrice,row.currentPrice);
    const again=await app.live.prepare(app.real.state.runs[0].id,['WRITE-1']);failReload=true;
    const result=await post('/api/kiot/commit',{id:again.id,confirmed:true});assert.equal(result.summary.succeeded,1);assert.equal(result.refreshError,undefined);assert.equal(reads,2);
  } finally {await new Promise(resolve=>app.server.close(resolve));}
});
async function setup(){
  const rows=[normalizeProduct({id:1,code:'AUTO-1',name:'Mẫu',basePrice:35e6,isActive:true,createdDate:'2026-12-03T12:00:00',inventories:[{branchId:44466,onHand:1}],description:''})];
  let fail=false;let calls=0;const client={all:async()=>{calls++;if(fail)throw Error('Mạng lỗi');return structuredClone(rows);},price:async()=>{throw Error('KHÔNG ĐƯỢC GHI');},note:async()=>{throw Error('KHÔNG ĐƯỢC GHI');}};
  const app=await createTestApp({store:memory(),liveStore:memory(),client,clock:()=>new Date('2027-01-20T03:00:00Z')});
  return {app,rows,client,fail:()=>{fail=true;},calls:()=>calls};
}
test('diagnostic endpoint uses the live server client for three GETs, never writes or changes history',async()=>{
  const {app,rows,client}=await setup();await app.refreshTable();let reads=0;
  client.product=async()=>{reads++;return structuredClone(rows[0]);};
  client.update=async()=>{throw Error('Không được ghi trong chẩn đoán');};
  const before=structuredClone(app.real.state);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
  try {
    const r=await fetch(base+'/api/kiot/diagnose',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({code:'AUTO-1'})});
    assert.equal(r.status,200);const data=await r.json();assert.equal(data.checks.length,3);assert.ok(data.checks.every(c=>c.ok));assert.equal(reads,3);assert.deepEqual(app.real.state,before);
  }finally{await new Promise(resolve=>app.server.close(resolve));}
});
test('manual reads calculate changed table without writing; unchanged keeps snapshot and P0',async()=>{
  const {app,rows,calls,fail}=await setup();await app.refreshTable();assert.equal(app.real.state.runs[0].rows[0].price,32.4e6);const id=app.real.state.runs[0].id;
  await app.keepCurrent();assert.equal(calls(),1);await app.refreshTable();assert.equal(app.real.state.runs[0].id,id);
  rows[0].name='Mẫu !';rows[0].currentPrice=33e6;await app.refreshTable();assert.notEqual(app.real.state.runs[0].id,id);assert.equal(app.real.state.products[0].p0,35e6);assert.equal(app.real.state.runs[0].rows[0].m,1);assert.equal(app.real.state.runs.length,1);
  const before=structuredClone(app.real.state);fail();await assert.rejects(app.refreshTable(),/Mạng lỗi/);assert.deepEqual(app.real.state,before);assert.match(app.live.progress.error,/Mạng lỗi/);
});
test('startup and the daily roll-forward never read Kiot; old unfinished write does not block reload; fixed history survives',async()=>{
  const {app,calls}=await setup();assert.equal(calls(),0);await app.keepCurrent();await app.keepCurrent();assert.equal(calls(),0);assert.equal(app.autoSync,undefined);
  app.real.state.updates=[{items:[{status:'note_pending'}]}];await app.refreshTable();assert.equal(calls(),1);
  app.real.state.updates=[];await app.refreshTable();const fixed=await app.real.run('2027-01-11');await app.refreshTable();assert.deepEqual(app.real.state.runs[1],fixed);
});
test('refresh HTTP produces table immediately; removed manual price endpoint never changes data',async()=>{
  const {app,rows}=await setup();rows[0].currentPrice=700e6;
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+app.server.address().port;
  const post=async(path,body)=>{const response=await fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({dataset:'real',...body})});assert.equal(response.status,200);return response.json();};
  try{
    await post('/api/kiot/refresh',{});assert.match(app.real.state.runs[0].rows[0].reasons.join(),/giá duyệt riêng/);
    const before=structuredClone(app.real.state);
    const response=await fetch(base+'/api/manual-price',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({dataset:'real',code:'AUTO-1',price:665e6,allowance:0})});
    assert.equal(response.status,410);assert.deepEqual(app.real.state,before);
  }finally{await new Promise(resolve=>app.server.close(resolve));}
});
