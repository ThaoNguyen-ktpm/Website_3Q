import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulator } from '../lib/service.js';
import { LiveService, liveNote } from '../lib/live.js';
import { KiotClient, normalizeProduct } from '../lib/kiot.js';
import { creationDay, calculate } from '../lib/pricing.js';
import { updateSummary, summaryText } from '../lib/update-report.js';

test('unpriced products archived after recovery; valid price returns identity/P0/history; unchanged refresh stays stable',async()=>{
  const f=await fixture();const old=await f.sim.run();
  for(const invalid of [0,-1,null,1.5]) {
    f.products[0].currentPrice=invalid;await f.live.refresh();assert.equal(f.sim.state.products.length,0);assert.equal(f.sim.state.archivedProducts[0].p0,35e6);
  }
  const bad=normalizeProduct(raw(2));bad.currentPrice=0;f.products.push(bad);
  await f.live.refresh();assert.equal(f.sim.state.products.length,0);
  const revision=f.sim.state.dataRevision;const result=await f.live.refresh({onlyWhenChanged:true});assert.equal(result.changed,false);assert.equal(f.sim.state.dataRevision,revision);
  f.products[0].currentPrice=30e6;f.products[1].currentPrice=12e6;await f.live.refresh();
  assert.equal(f.sim.state.products.length,2);assert.equal(f.sim.state.products[0].p0,35e6);assert.equal(f.sim.state.products[1].p0,12e6);assert.deepEqual(f.sim.state.runs[0],old);
  assert.equal(new Set([...f.sim.state.products,...f.sim.state.archivedProducts].map(p=>p.id)).size,2);
});

const clone=structuredClone;
const raw=(id=1)=>({id,code:'REAL-'+id,name:'Túi '+id,basePrice:35e6,createdDate:'2026-12-03T17:39:24.6030000',isActive:true,description:'<p>Ghi chú gốc !</p>',inventories:[{branchId:44466,onHand:1}],categoryId:123});
const now=()=>new Date('2027-01-20T03:00:00Z');
async function fixture() {
  let saved=null;
  const store={read:async()=>clone(saved),write:async value=>{saved=clone(value);}};
  const products=[normalizeProduct(raw())];
  const writes=[];
  const client={all:async cb=>{cb({loaded:products.length,total:products.length});return clone(products);},
    product:async id=>clone(products.find(p=>p.id===id)),
    update:async(p,fields)=>{assert.ok(['sending','rolling_back'].includes(saved.updates[0].items.find(i=>i.id===p.id).status));writes.push('update');const item=products.find(x=>x.id===p.id);if('basePrice' in fields)item.currentPrice=fields.basePrice;if('description' in fields)item.notes=fields.description;},
    price:async(p,value)=>{assert.equal(saved.updates[0].items[0].status,'price_pending');writes.push('price');products.find(x=>x.id===p.id).currentPrice=value;},
    note:async(p,value)=>{assert.equal(saved.updates[0].items[0].status,'note_pending');writes.push('note');products.find(x=>x.id===p.id).notes=value;}};
  const sim=new Simulator(store,{load:async()=>[]},now);await sim.initialize();
  const live=new LiveService(sim,client,now);sim.live=live;
  await live.refresh();sim.state.products[0].floor=1e6; // Legacy data remains stored but is ignored.
  const verify=()=>live.mapping({code:'REAL-1',observedPrice:35e6,observedCreatedAt:'2026-12-03T17:39',priceConfirmed:true,dateConfirmed:true,noteConfirmed:true,noteField:'description'});
  const ready=async()=>{await verify();const run=await sim.run();return live.prepare(run.id,['REAL-1']);};
  return {store,sim,live,client,products,writes,ready,verify,saved:()=>clone(saved)};
}

test('Kiot fractional seconds, calendar and branch fields',()=>{
  assert.equal(creationDay(raw().createdDate),'2026-12-03');
  assert.equal(creationDay('2026-10-13T24:10:10.6030000'),null);
  const p=normalizeProduct(raw());assert.equal(p.stock,1);assert.equal(p.rawSource.createdDate,raw().createdDate);
  assert.equal(calculate({...p,p0:35e6,floor:1e6},'2027-01-20').m,3);
  assert.equal(calculate({...p,p0:35e6,floor:null},'2027-01-20').status,'simulated');
  assert.equal(calculate({...p,p0:35e6,stock:0},'2027-01-20').status,'excluded');
  assert.equal(normalizeProduct({...raw(),inventories:[]}).inventoryMissing,true);
});
test('all pages 100; rejects duplicate, changing totals, missing pages',async()=>{
  const client=new KiotClient();const paths=[];
  client.request=async path=>{paths.push(path);const offset=Number(new URL('https://x'+path).searchParams.get('currentItem'));return {total:205,data:Array.from({length:Math.min(100,205-offset)},(_,i)=>raw(offset+i+1))};};
  const progress=[];assert.equal((await client.all(p=>progress.push(p))).length,205);
  assert.equal(paths.length,3);assert.match(paths[1],/currentItem=100/);assert.deepEqual(progress.map(p=>p.loaded),[100,200,205]);
  client.request=async()=>({total:2,data:[raw(1),raw(1)]});await assert.rejects(client.all(),/trùng/);
  let n=0;client.request=async()=>({total:++n===1?2:3,data:[raw(n)]});await assert.rejects(client.all(),/đổi/);
  client.request=async()=>({total:2,data:[]});await assert.rejects(client.all(),/thiếu/);
});
test('reload preserves P0/floor/manual/history; failed import is atomic; missing product excluded',async()=>{
  const f=await fixture();await f.sim.run();const old=clone(f.sim.state.runs);
  f.sim.state.products[0].manualPricing={price:30e6,allowance:1e6};
  f.products[0].currentPrice=31e6;await f.live.refresh();
  assert.equal(f.sim.state.products[0].p0,35e6);assert.equal(f.sim.state.products[0].floor,1e6);assert.equal(f.sim.state.products[0].manualPricing.price,30e6);assert.deepEqual(f.sim.state.runs,old);
  const previous=clone(f.sim.state);f.client.all=async()=>{throw Error('Trang 2 lỗi');};await assert.rejects(f.live.refresh(),/Trang 2/);assert.deepEqual(f.sim.state,previous);
  f.client.all=async()=>[];await f.live.refresh();assert.equal(f.sim.state.products.length,0);assert.equal(f.sim.state.archivedProducts[0].seen,false);assert.equal(f.sim.state.archivedProducts[0].active,false);
});
test('field verification, policy, date and refresh revision gate writes without floors',async()=>{
  const f=await fixture();const run=await f.sim.run();await f.live.prepare(run.id,['REAL-1']);
  await assert.rejects(f.live.mapping({priceConfirmed:true,dateConfirmed:true,noteConfirmed:true,noteField:'notes'}),/đối chiếu/);
  await f.verify();await f.live.refresh();await assert.rejects(f.live.prepare(run.id,['REAL-1']),/mới nhất/);
  f.sim.state.products[0].floor=34e6;const low=await f.sim.run();assert.equal(low.rows[0].status,'simulated');await f.live.prepare(low.id,['REAL-1']);
  f.sim.state.runs[0].policy='old-policy';await assert.rejects(f.live.prepare(low.id,['REAL-1']),/mới nhất/);
  assert.equal(f.writes.length,0);
});
test('cancel and absent confirmation make no writes; consumed confirmation cannot repeat',async()=>{
  const f=await fixture();let p=await f.ready();await assert.rejects(f.live.commit(p.id,false),/xác nhận/);await f.live.cancel(p.id);await assert.rejects(f.live.commit(p.id,true),/hợp lệ/);assert.equal(f.writes.length,0);
  p=await f.ready();const result=await f.live.commit(p.id,true);assert.equal(result.items[0].status,'done');assert.deepEqual(f.writes,['update']);assert.equal(f.products[0].currentPrice,32.4e6);assert.equal(f.sim.state.products[0].p0,35e6);
  await assert.rejects(f.live.commit(p.id,true),/hợp lệ/);assert.equal(f.writes.length,1);
  const run=await f.sim.run();const second=await f.live.prepare(run.id,['REAL-1']);await f.live.commit(second.id,true);assert.equal(f.writes.length,1);assert.equal((f.products[0].notes.match(/data-baoq-event/g)||[]).length,1);
});
test('external changes detected both before proposal and after confirmation',async()=>{
  const f=await fixture();await f.verify();let r=await f.sim.run();f.products[0].name+=' !';await assert.rejects(f.live.prepare(r.id,['REAL-1']),/thay đổi/);assert.equal(f.writes.length,0);
  f.products[0].name='Túi 1';const p=await f.live.prepare(r.id,['REAL-1']);f.products[0].notes+=' New';const result=await f.live.commit(p.id,true);assert.equal(result.items[0].status,'preflight_failed');assert.equal(f.writes.length,0);
});
test('lock prevents simultaneous imports and simulations',async()=>{
  const f=await fixture();let release;f.client.all=async()=>new Promise(resolve=>{release=()=>resolve(clone(f.products));});const loading=f.live.refresh();await assert.rejects(f.sim.run(),e=>e.status===409);release();await loading;
});
test('old unmatched BAOQ markers never absorb the original identifier on repeat',()=>{
 const original='<!--BAOQ-CURRENT--><p>Mã định danh gốc</p><!--BAOQ-CURRENT-->',row={m:3,price:3900000,currentPrice:5000000,allowance:117000};
 const first=liveNote(original,row,'key','2027-01-22 13:00');const second=liveNote(first,row,'key','2027-01-22 14:00');
 assert.equal(first,second);assert.ok(second.endsWith(original));assert.equal((second.match(/data-baoq-event=/g)||[]).length,1);
});
test('owned note block does not erase original description or duplicate events',()=>{
  const row={m:3,price:32.4e6,currentPrice:35e6,allowance:972000};const before='<b>Nội dung gốc</b>';const once=liveNote(before,row,'k','2027-01-20');const twice=liveNote(once,row,'k','2027-01-20');assert.ok(twice.startsWith('<!--BAOQ-CURRENT-->'));assert.ok(twice.endsWith(before));assert.equal(twice,once);assert.equal((twice.match(/data-baoq-event/g)||[]).length,1);assert.equal((twice.match(/<!--BAOQ-CURRENT-->/g)||[]).length,1);
});
test('changed local inputs, M, tax or withdrawn inventory cannot be written',async()=>{
  for(const change of ['manual','m','stock','tax']) {
    const f=await fixture();const p=await f.ready();
    if(change==='manual')f.sim.state.products[0].manualPricing={price:1,allowance:0};
    if(change==='m')f.live.clock=()=>new Date('2027-02-12T03:00:00Z');
    if(change==='stock')f.products[0].stock=0;
    if(change==='tax')f.products[0].taxPresent=true;
    if(change==='m'){await assert.rejects(f.live.commit(p.id,true),/hợp lệ/);}
    else {const result=await f.live.commit(p.id,true);assert.equal(result.items[0].status,'preflight_failed');}
    assert.equal(f.writes.length,0);
  }
});
test('Kiot adapter only sends intended field and unchanged required identity, tokens stay server-side',async()=>{
  const requests=[];
  const client=new KiotClient({credentials:{retailer:'baoqluxury',client:'TEST',secret:'FAKE'},fetcher:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.includes('connect/token')?{access_token:'FAKE-TOKEN',expires_in:3600}:{id:1}};}});
  const p=normalizeProduct(raw());await client.price(p,32.4e6);await client.note(p,'Test');
  assert.equal(requests.length,3);const price=JSON.parse(requests[1].options.body),note=JSON.parse(requests[2].options.body);
  assert.deepEqual(Object.keys(price).sort(),['basePrice','categoryId','code','name']);assert.deepEqual(Object.keys(note).sort(),['categoryId','code','description','name']);assert.equal(price.basePrice,32.4e6);assert.equal(note.description,'Test');assert.match(requests[1].url,/branchId=44466/);assert.equal(requests[1].options.method,'PUT');
});
test('stock filter uses branch 44466, keeps separate SPs with identical names and one row for quantity 2',async()=>{
  const rows=[raw(1),raw(2),raw(3),raw(4),raw(5),raw(6),raw(7)];
  rows[0].name=rows[1].name='Tên trùng';rows[1].basePrice=50e6;rows[1].inventories[0].onHand=2;
  rows[2].inventories[0].onHand=0;rows[3].inventories[0].onHand=-1;
  rows[4].inventories=[{branchId:999,onHand:10}];rows[5].isActive=false;rows[6].inventories[0].onHand=null;
  const client=new KiotClient();client.request=async path=>{assert.match(path,/BranchIds=44466/);assert.match(path,/isActive=true/);return {total:rows.length,data:rows};};
  const result=await client.all();assert.deepEqual(result.map(p=>p.code),['REAL-1','REAL-2']);assert.equal(result[1].stock,2);assert.deepEqual(client.lastImport,{read:7,kept:2,filtered:5});
  assert.equal(result[0].name,result[1].name);assert.notEqual(result[0].id,result[1].id);
});
test('out-of-stock archive preserves cycle on restock and histories are untouched',async()=>{
  const f=await fixture();f.sim.state.products[0].manualPricing={price:30e6,allowance:1e6};await f.sim.run();const history=clone(f.sim.state.runs);
  f.products[0].stock=0;await f.live.refresh();assert.equal(f.sim.state.products.length,0);assert.equal(f.sim.state.archivedProducts[0].p0,35e6);
  const emptyRun=await f.sim.run();assert.equal(emptyRun.rows.length,0);assert.deepEqual(f.sim.state.runs[1],history[0]);
  f.products[0].stock=2;f.products[0].currentPrice=40e6;await f.live.refresh();
  const p=f.sim.state.products[0];assert.equal(p.p0,35e6);assert.equal(p.floor,1e6);assert.equal(p.manualPricing.price,30e6);assert.equal(p.stock,2);assert.equal(f.sim.state.archivedProducts.length,0);
  f.client.all=async()=>{throw Error('Thiếu trang');};const before=clone(f.sim.state);await assert.rejects(f.live.refresh());assert.deepEqual(f.sim.state,before);
});
