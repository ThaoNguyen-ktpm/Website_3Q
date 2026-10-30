import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calculate, previewNote, vietnamTime, creationDay, typeFromName } from '../lib/pricing.js';
import { Simulator } from '../lib/service.js';
import { Store } from '../lib/store.js';
import { SampleSource } from '../lib/samples.js';
import { FakeSink, fakeApply, failureScenarios } from '../lib/fake-sync.js';
import { createTestApp } from './http-fixture.js';
const item = (overrides = {}) => ({ code:'T', name:'Test', p0:35e6, currentPrice:35e6,
  createdAt:'2026-10-16', stock:1, active:true, type:'normal', floor:0, notes:'Ghi chú gốc', ...overrides });
const dayAt = age => new Date(Date.parse('2026-10-16') + age * 86400000).toISOString().slice(0,10);

test('only ASCII exclamation marks in a nonblank name determine type', () => {
  for (const name of ['!Túi','Túi ! LV','Túi!','!!Túi!!!']) {
    assert.equal(typeFromName(name),'hottrend');
    assert.equal(calculate(item({name,type:'normal'}),dayAt(45)).m,1);
  }
  for (const name of ['Túi LV Spa 1/7/2026','Túi！','Hàng thường']) {
    const row=calculate(item({name,code:'SKU!',notes:'Hottrend !',type:'hottrend'}),dayAt(45));
    assert.equal(row.type,'normal');assert.equal(row.m,3);
  }
  for (const name of [null,undefined,'',' \t\n ',42]) {
    const row=calculate(item({name}),dayAt(45));
    assert.equal(row.type,null);assert.equal(row.m,null);assert.match(row.reasons.join(),/tên sản phẩm/);
  }
  for (const [age,normal,hottrend] of [[44,2,0],[45,3,1],[60,4,2],[75,5,3],[120,6,6]]) {
    assert.equal(calculate(item({name:'Túi'}),dayAt(age)).m,normal);
    assert.equal(calculate(item({name:'Túi !'}),dayAt(age)).m,hottrend);
  }
});

test('rename changes new snapshots only and never resets P0', async () => {
  const store={read:async()=>null,write:async()=>{}};
  const simulator=new Simulator(store,{load:async()=>[item()]});
  await simulator.initialize();const first=await simulator.run(dayAt(45));
  const original=structuredClone(first);
  await simulator.mutate(state=>{state.products[0].name='Test !';});
  const second=await simulator.run(dayAt(45));
  assert.equal(second.rows[0].name,'Test !');assert.equal(second.rows[0].type,'hottrend');assert.equal(second.rows[0].m,1);
  assert.equal(second.rows[0].p0,35e6);assert.equal(simulator.state.products[0].currentPrice,35e6);
  assert.deepEqual(simulator.state.runs[1],original);
  await simulator.mutate(state=>{state.products[0].name='Test';});
  const third=await simulator.run(dayAt(45));assert.equal(third.rows[0].type,'normal');assert.equal(third.rows[0].price,first.rows[0].price);
  assert.deepEqual(simulator.state.runs[2],original);
});

test('legacy migration preserves prices notes histories and adds screenshot seeds once', async () => {
  const source=new SampleSource();const seeds=await source.load();
  const old={version:1,policy:'old-policy',products:seeds.slice(0,10).map(p=>({...p,p0:p.currentPrice+123,notes:'Ghi chú cũ !',type:'hottrend'})),
    runs:[{id:'old',rows:[{name:'Tên cũ',type:null,p0:99,price:80}]}]};
  old.products.find(p=>p.code==='TEST-HOT').name='Đồng hồ giả định hottrend 90 triệu';
  const original=structuredClone(old);let persisted;
  const store={read:async()=>structuredClone(persisted||old),write:async state=>{persisted=structuredClone(state);}};
  const simulator=new Simulator(store,source);await simulator.initialize();
  assert.equal(simulator.state.products.length,18);assert.deepEqual(simulator.state.runs,original.runs);
  for (const before of original.products) {
    const after=simulator.state.products.find(p=>p.code===before.code);
    assert.deepEqual([after.p0,after.currentPrice,after.notes],[before.p0,before.currentPrice,before.notes]);
    assert.equal(after.type,typeFromName(after.name));
  }
  assert.match(simulator.state.products.find(p=>p.code==='TEST-HOT').name,/!/);
  const image=simulator.state.products.filter(p=>p.source==='Từ ảnh hottrend — bản sao mẫu');
  assert.equal(image.length,8);assert.ok(image.every(p=>p.type==='hottrend'));
  assert.equal(image.find(p=>p.code==='SP024540').currentPrice,105e6);
  const snapshot=structuredClone(simulator.state);await simulator.initialize();assert.deepEqual(simulator.state,snapshot);
});
test('ordinary and hottrend boundaries, capped M6', () => {
  for (const [age,m] of [[0,0],[14,0],[15,1],[29,1],[30,2],[44,2],[45,3],[59,3],[60,4],[74,4],[75,5],[89,5],[90,6],[400,6]]) assert.equal(calculate(item(),dayAt(age)).m,m);
  for (const [age,m] of [[0,0],[44,0],[45,1],[59,1],[60,2],[74,2],[75,3],[89,3],[90,4],[104,4],[105,5],[119,5],[120,6],[400,6]]) assert.equal(calculate(item({name:'!Test',type:'normal'}),dayAt(age)).m,m);
});
test('under 5m policy covers exact boundaries, all M and both calendars with no sale rights',()=>{
  for(const p0 of [1,1999999,2000000,4999999]) for(const name of ['Hàng thường','Hottrend !']) for(let m=0;m<=6;m++) {
    const age=name.includes('!')?(m===0?44:30+m*15):m*15;
    const r=calculate(item({p0,name}),dayAt(age));
    assert.equal(r.m,m);assert.equal(r.allowance,0);assert.equal(r.price,p0-(p0<2e6?0:m*200000));assert.equal(r.net,r.price);assert.equal(r.status,'simulated');
  }
  const exact5=calculate(item({p0:5e6}),dayAt(45));assert.equal(exact5.price,3.9e6);assert.equal(exact5.allowance,117000);
  const locked=calculate(item({p0:5e6,currentPrice:4e6}),dayAt(15));assert.equal(locked.price,4.7e6);assert.equal(locked.allowance,800000);
});

test('all markdown bands at lower boundaries and cumulative M6', () => {
  for (const [p0,m1,m3,m6] of [[9e6,.3,1.1,2.6],[10e6,.5,1.7,3.8],[20e6,.8,2.6,5.6],[50e6,1.5,4.5,9],
    [100e6,2.5,7.5,15],[150e6,3,9,18],[200e6,4,12,24],[250e6,5,15,30],[300e6,7,21,42],[400e6,8,24,48],[500e6,10,30,60]]) {
    for(const [age,markdown] of [[15,m1],[45,m3],[90,m6]]) assert.equal(calculate(item({p0}),dayAt(age)).markdown,markdown*1e6);
  }
  assert.equal(calculate(item({p0:600e6}),dayAt(45)).price,null);
  assert.equal(calculate(item({p0:101e6}),dayAt(45)).price,93.5e6);
});
test('sale allowance uses after-markdown price and stops at M4', () => {
  assert.equal(calculate(item(),dayAt(15)).allowance,1710000);
  assert.equal(calculate(item(),dayAt(45)).allowance,972000);
  assert.equal(calculate(item({p0:15e6}),dayAt(45)).allowance,399000);
  for (const [p0,allowance] of [[9e6,800000],[15e6,1000000],[100e6,6e6],[150e6,7e6],[200e6,8e6],[300e6,10e6],[400e6,15e6],[500e6,15e6]]) {
    assert.equal(calculate(item({p0}),dayAt(0)).allowance,allowance);
    if(p0>=100e6) assert.equal(calculate(item({p0}),dayAt(45)).allowance,allowance/2);
  }
  for(const age of [60,75,90]) assert.equal(calculate(item(),dayAt(age)).allowance,0);
  assert.deepEqual([0,15,30,45,60,75,90].map(a=>calculate(item(),dayAt(a)).price),[35e6,34.2e6,33.4e6,32.4e6,31.4e6,30.4e6,29.4e6]);
});
test('created date, Vietnamese calendar, floor and invalid inputs', () => {
  assert.equal(calculate(item({createdAt:'2023-12-20T23:42'}),'2027-01-20').age,null);
  assert.equal(calculate(item({createdAt:'2026-11-22'}),'2027-01-20').age,59);
  assert.equal(creationDay('2026-10-13T18:00:00Z'),'2026-10-14');
  assert.equal(creationDay('2026-02-30'),null);assert.equal(creationDay('2026-10-13T25:00'),null);
  assert.equal(creationDay('2026-02-30T12:00:00Z'),null);
  assert.deepEqual(vietnamTime(new Date('2027-01-19T17:05:00Z')),{date:'2027-01-20',time:'00:05'});
  assert.equal(calculate(item({floor:null}),dayAt(45)).price,32.4e6);
  for(const floor of [null,32e6,100e6,-1,NaN]) assert.equal(calculate(item({floor}),dayAt(45)).status,'simulated');
  for(const override of [{name:null},{name:'  '},{createdAt:null},{createdAt:'2027-04-15'},{p0:0},{p0:NaN}]) assert.equal(calculate(item(override),'2027-01-20').status,'waiting');
  assert.equal(calculate(item({stock:0}),dayAt(45)).status,'excluded');
  assert.equal(calculate(item({active:false}),dayAt(45)).status,'excluded');
  assert.equal(calculate(item({p0:2e6}),dayAt(90)).status,'simulated');assert.throws(()=>calculate(item(),'wrong'));
});
test('preview preserves notes and replaces own block without duplicate', () => {
  const row=calculate(item(),dayAt(45));const a=previewNote('Ghi chú gốc\nLịch sử cũ',row,dayAt(45));
  assert.equal(previewNote(a,row,dayAt(45)),a);assert.ok(a.startsWith('[BAOQ-MO-PHONG]'));assert.ok(a.endsWith('Ghi chú gốc\nLịch sử cũ'));assert.match(a,/Chỉ mô phỏng/);
});
test('mock error retries are idempotent and keep original notes', () => {
  assert.ok(failureScenarios().every(r=>r.passed&&r.preserved));const sink=new FakeSink(item());
  fakeApply(sink,dayAt(45));fakeApply(sink,dayAt(45));fakeApply(sink,dayAt(60));
  assert.equal(sink.priceWrites,2);assert.equal(sink.events.length,2);assert.equal(sink.product.currentPrice,31.4e6);
  assert.match(sink.product.notes,/Quyền sale 0đ/);assert.equal(sink.product.p0,35e6);
});
test('persist P0 and runs; do not mutate prices; corrupt store fails closed', async () => {
  const dir=await mkdtemp(join(tmpdir(),'baoq-store-'));const path=join(dir,'state.json');
  try {
    const simulator=new Simulator(new Store(path),new SampleSource(),()=>new Date('2027-01-20T03:00:00Z'));
    await simulator.initialize();const original=simulator.state.products.map(p=>[p.p0,p.currentPrice]);
    const first=await simulator.run();const second=await simulator.run();assert.deepEqual(first.rows,second.rows);
    assert.deepEqual(simulator.state.products.map(p=>[p.p0,p.currentPrice]),original);
    const restarted=new Simulator(new Store(path),{load:()=>{throw new Error('must not reload');}});
    await restarted.initialize();assert.equal(restarted.state.products[0].type,'normal');assert.equal(restarted.state.runs.length,2);
    await writeFile(path,'broken');await assert.rejects(restarted.initialize());assert.equal(await readFile(path,'utf8'),'broken');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
test('concurrent runs blocked, persistence failure restores busy state', async () => {
  let release;const wait=new Promise(resolve=>release=resolve);const store={read:async()=>null,write:async()=>{}};
  const simulator=new Simulator(store,new SampleSource());await simulator.initialize();store.write=()=>wait;
  const running=simulator.run('2027-01-20');await assert.rejects(simulator.run('2027-01-20'),/Đang xử lý/);release();await running;
  store.write=async()=>{throw new Error('disk failure');};const before=simulator.state.runs.length;
  await assert.rejects(simulator.run('2027-01-20'),/disk failure/);assert.equal(simulator.state.runs.length,before);assert.equal(simulator.busy,false);
});
test('local HTTP: reject foreign origin, no live write endpoint', async () => {
  const dir=await mkdtemp(join(tmpdir(),'baoq-http-'));const {server}=await createTestApp({store:new Store(join(dir,'state.json')),clock:()=>new Date('2027-01-20T03:00:00Z')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const post=(path,body,origin=base)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  try {
    assert.match(await(await fetch(base)).text(),/Kết quả kiểm thử/);assert.equal((await fetch(base+'/api/state')).status,200);
    // Foreign-origin rejection is tested through the website middleware in saleAiProxy.test.ts.
    const response=await post('/api/run',{});assert.equal(response.status,200);assert.equal((await response.json()).label,'Đã mô phỏng');
    assert.equal((await post('/api/kiot/update',{})).status,404);
    assert.equal((await post('/api/classify',{code:'SP000395',type:'normal'})).status,404);
    assert.equal((await post('/api/settings',{enabled:true,time:'09:00'})).status,404); // schedule removed 21/10/2026
    assert.equal((await post('/api/scenarios',{})).status,200);assert.equal((await fetch(base+'/../../AGENTS.md')).status,404);
  } finally { await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true}); }
});
