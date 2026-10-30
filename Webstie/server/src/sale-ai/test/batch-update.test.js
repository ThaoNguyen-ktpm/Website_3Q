import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulator} from '../lib/service.js';
import {LiveService} from '../lib/live.js';
import {normalizeProduct,KiotClient} from '../lib/kiot.js';
import {summaryText} from '../lib/update-report.js';
const clone=structuredClone, clock=()=>new Date('2027-01-20T03:00:00Z');
async function fixture(count=3) {
  let disk=null;const store={read:async()=>clone(disk),write:async s=>{disk=clone(s);}};
  const products=Array.from({length:count},(_,i)=>normalizeProduct({id:i+1,code:'B-'+(i+1),name:'Mẫu '+(i+1),basePrice:35e6,createdDate:'2026-12-03',isActive:true,description:'Ghi chú cũ',inventories:[{branchId:44466,onHand:1}]}));
  const original=clone(products),calls=[];
  const apply=(id,fields)=>{const p=products.find(p=>p.id===id);if('basePrice' in fields)p.currentPrice=fields.basePrice;if('description' in fields)p.notes=fields.description;};
  const client={all:async()=>clone(products),product:async id=>clone(products.find(p=>p.id===id)),update:async(p,fields)=>{
    const journal=disk.updates[0].items.find(i=>i.id===p.id);assert.ok(['sending','rolling_back'].includes(journal.status));calls.push({id:p.id,fields:clone(fields),status:journal.status});apply(p.id,fields);
  }};
  const sim=new Simulator(store,{load:async()=>[]},clock);await sim.initialize();const live=new LiveService(sim,client,clock);sim.live=live;await live.refresh();sim.state.mapping={verified:true};
  const proposal=await live.prepare((await sim.run()).id,products.map(p=>p.code));
  return {sim,live,client,products,original,calls,apply,proposal,store,disk:()=>clone(disk)};
}
test('all selected products are checked before any write; errors stored; old errors do not block new reads',async()=>{
  const f=await fixture();f.products[1].name+=' changed';const u=await f.live.commit(f.proposal.id,true);
  assert.equal(u.outcome,'preflight_failed');assert.equal(f.calls.length,0);assert.deepEqual(u.items.map(i=>i.status),['not_sent','preflight_failed','not_sent']);assert.match(u.items[1].error,/Kiot/);
  f.sim.state.updates.push({items:[{status:'price_pending',code:'OLD'}]});await f.live.refresh();
  await assert.rejects(f.live.retry(u.id,true),e=>e.status===410);
});
test('GET failure immediately before PUT has correct stage, safe diagnostic and no write',async()=>{
  const f=await fixture(1);const read=f.client.product;let count=0;
  f.client.product=async id=>{if(++count===2){const e=new Error('Connect timeout');e.diagnostic={code:'UND_ERR_CONNECT_TIMEOUT',method:'GET',path:'/products/1'};throw e;}return read(id);};
  const u=await f.live.commit(f.proposal.id,true);
  assert.equal(f.calls.length,0);assert.equal(u.items[0].stage,'Đọc đối chiếu trước ghi');assert.equal(u.items[0].requestSent,false);assert.equal(u.items[0].diagnostic.code,'UND_ERR_CONNECT_TIMEOUT');
});
test('closed socket on pre-write GET recovers through KiotClient and permits exactly one price/note PUT',async()=>{
  const f=await fixture(1);let reads=0;
  const adapter=new KiotClient({credentials:{retailer:'baoqluxury',client:'FAKE',secret:'FAKE'},fetcher:async(url,options)=>{
    assert.equal(options.method,'GET');assert.equal(options.headers.Connection,'close');
    if(++reads===2)throw Object.assign(new TypeError('fetch failed'),{cause:{code:'UND_ERR_SOCKET'}});
    const p=f.products[0];return {ok:true,status:200,json:async()=>({id:p.id,code:p.code,name:p.name,basePrice:p.currentPrice,createdDate:p.createdAt,isActive:p.active,description:p.notes,inventories:[{branchId:44466,onHand:p.stock}]})};
  }});adapter.token='FAKE';adapter.expires=Date.now()+60000;
  f.client.product=id=>adapter.product(id);
  const u=await f.live.commit(f.proposal.id,true);
  assert.equal(u.outcome,'success');assert.equal(f.calls.length,1);assert.equal(f.products[0].currentPrice,32.4e6);assert.equal(adapter.lastReadRecovery.code,'UND_ERR_SOCKET');assert.equal(adapter.lastReadRecovery.attempts,2);
});
test('success sends price and note together once per product and keeps P0',async()=>{
  const f=await fixture();const u=await f.live.commit(f.proposal.id,true);assert.equal(u.outcome,'success');assert.equal(u.summary.succeeded,3);
  assert.equal(f.calls.length,3);assert.ok(f.calls.every(c=>Object.keys(c.fields).length===2));assert.ok(f.sim.state.products.every(p=>p.p0===35e6));assert.match(summaryText(u.summary,u),/thành công 3/);
});
test('middle failure stops remaining products, retains successful changes, never restores old values',async()=>{
  const f=await fixture();const write=f.client.update;
  f.client.update=async(p,fields)=>{if(p.id===2&&fields.basePrice!==35e6){f.calls.push({id:2});f.apply(2,{basePrice:fields.basePrice});throw Error('Lỗi ghi chú');}await write(p,fields);};
  const u=await f.live.commit(f.proposal.id,true);assert.equal(u.outcome,'partial_failure');assert.deepEqual(u.items.map(i=>i.status),['done','write_failed','not_sent']);
  assert.deepEqual(f.calls.map(c=>c.id),[1,2]);assert.equal(f.products[0].currentPrice,32.4e6);assert.equal(f.products[1].currentPrice,32.4e6);assert.equal(f.products[1].notes,'Ghi chú cũ');assert.deepEqual(f.products[2],f.original[2]);assert.equal(u.summary.succeeded,1);assert.match(u.items[1].error,/ghi chú/);assert.match(summaryText(u.summary,u),/thành công 1/);
});
test('timeouts only read back: confirmed receipt stays applied, unreceived write remains failed',async()=>{
  for(const receipt of [false,true]){
    const f=await fixture(1);const write=f.client.update;let first=true;
    f.client.update=async(p,fields)=>{if(first){first=false;if(receipt)await write(p,fields);throw Error('Timeout');}await write(p,fields);};
    const u=await f.live.commit(f.proposal.id,true);assert.equal(u.items[0].status,receipt?'done':'write_failed');assert.equal(f.calls.length,receipt?1:0);if(receipt){assert.equal(f.products[0].currentPrice,32.4e6);assert.equal((f.products[0].notes.match(/data-baoq-event/g)||[]).length,1);}else {assert.deepEqual(f.products,f.original);assert.match(u.items[0].error,/Timeout/);}
  }
});
test('failure never issues rollback requests or overwrites external edits',async()=>{
  const f=await fixture(2);const write=f.client.update;
  f.client.update=async(p,fields)=>{if(p.id===2){f.products[0].currentPrice=99e6;throw Error('Write failed');}assert.notEqual(fields.basePrice,35e6);await write(p,fields);};
  const u=await f.live.commit(f.proposal.id,true);assert.equal(u.outcome,'partial_failure');assert.equal(f.products[0].currentPrice,99e6);assert.equal(f.calls.length,1);assert.equal(u.items[1].status,'write_failed');
});
test('network loss leaves unknown; restart preserves journal and makes no external requests',async()=>{
  const f=await fixture(1);const write=f.client.update,read=f.client.product;let offline=false;
  f.client.update=async(p,fields)=>{await write(p,fields);offline=true;throw Error('Mất mạng');};f.client.product=async id=>{if(offline)throw Error('Không đọc được');return read(id);};
  const u=await f.live.commit(f.proposal.id,true);assert.equal(u.items[0].status,'unknown');assert.equal(u.outcome,'partial_failure');
  await f.sim.mutate(s=>{s.updates[0].items[0].status='sending';s.updates[0].attempts[0].status='running';});
  const old=clone(f.calls);const restarted=new Simulator(f.store,{load:async()=>[]},clock);await restarted.initialize();assert.equal(restarted.state.updates[0].outcome,'interrupted');assert.equal(restarted.state.updates[0].items[0].status,'unknown');assert.deepEqual(f.calls,old);
});
test('journal failure before sending prevents writes and active batch retains lock',async()=>{
  const f=await fixture(1);const save=f.store.write;f.store.write=async s=>{if(s.updates?.[0]?.items[0].status==='sending')throw Error('Disk error');return save(s);};
  const u=await f.live.commit(f.proposal.id,true);assert.equal(f.calls.length,0);assert.equal(u.items[0].status,'write_failed');
  const g=await fixture(1);const read=g.client.product;let release;
  g.client.product=async id=>{await new Promise(r=>{release=r;});g.client.product=read;return read(id);};
  const pending=g.live.commit(g.proposal.id,true);await new Promise(r=>setImmediate(r));await assert.rejects(g.live.refresh(),e=>e.status===409);release();await pending;
});
test('Kiot combined adapter accepts only price/note fields',async()=>{
  const requests=[];const client=new KiotClient({credentials:{retailer:'baoqluxury',client:'TEST',secret:'FAKE'},fetcher:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>url.includes('connect/token')?{access_token:'FAKE',expires_in:3600}:{}};}});
  await client.update({id:1,rawFields:{code:'B-1',name:'Mẫu',categoryId:1}},{basePrice:10,description:'Ghi chú'});
  assert.deepEqual(JSON.parse(requests[1].options.body),{code:'B-1',name:'Mẫu',categoryId:1,basePrice:10,description:'Ghi chú'});
  await assert.rejects(client.update({id:1},{inventory:1}),/không hợp lệ/);
});
