import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulator} from '../lib/service.js';
import {LiveService} from '../lib/live.js';
import {normalizeProduct,KiotClient} from '../lib/kiot.js';
import {SapoService} from '../lib/sapo.js';
import {createTestApp} from './http-fixture.js';
import {createSaleAi} from '../core.js';
export const memory=()=>{let disk=null;return {read:async()=>structuredClone(disk),write:async s=>{disk=structuredClone(s);}};};
export async function fixture(count=2){
 const clock=()=>new Date('2027-01-22T03:00:00Z'),store=memory(),calls=[];
 const products=Array.from({length:count},(_,n)=>normalizeProduct({id:n+1,code:n===0?'SP000009':'SP000010',name:'Túi '+n,basePrice:35e6,createdDate:'2026-12-03',isActive:true,description:'Kiot gốc',inventories:[{branchId:44466,onHand:1}]}));
 const sapos=products.map((p,n)=>({id:91211362+n,content:'<b>HTML gốc</b>',variants:[{id:900+n,sku:p.code,price:35e6},{id:990+n,sku:'OTHER'+n,price:123}]}));
 const kiot={all:async()=>structuredClone(products),product:async id=>structuredClone(products.find(p=>p.id===id)),update:async(p,b)=>{calls.push('kiot:'+p.code);Object.assign(products.find(x=>x.id===p.id),{currentPrice:b.basePrice,notes:b.description});}};
 const sc={all:async()=>structuredClone(sapos),product:async id=>structuredClone(sapos.find(p=>p.id===id)),restore:async(id,variants,content)=>{calls.push('sapo:'+id);const p=sapos.find(p=>p.id===id);for(const v of variants)p.variants.find(x=>x.id===v.id).price=v.price;p.content=content;},update:async(id,vid,price,content)=>{calls.push('sapo:'+id);const p=sapos.find(p=>p.id===id);p.variants.find(v=>v.id===vid).price=price;if(content!==null)p.content=content;}};
 const sapo=new SapoService(sc,memory(),'fake');await sapo.initialize();await sapo.refresh();const check=await sapo.check('SP000009');await sapo.confirm({...check,confirmed:true});
 const sim=new Simulator(store,{load:async()=>[]},clock);await sim.initialize();const live=new LiveService(sim,kiot,clock);sim.live=live;live.sapo=sapo;live.requireJoint=true;live.timingSink=()=>{};await live.refresh();sim.state.mapping={verified:true};const run=await sim.run();
 return {sim,live,sapo,sc,kiot,products,sapos,store,calls,run,prepare:codes=>live.prepare(run.id,codes||products.map(p=>p.code))};
}
test('read-only preview works before mapping and never creates a commit or saves state',async()=>{
 const f=await fixture(1);f.sapo.state.mapping=null;f.sim.state.mapping=null;
 const before=structuredClone(f.sim.state),sapoBefore=structuredClone(f.sapo.state);
 f.store.write=async()=>{throw Error('Preview must not save');};
 const p=await f.live.prepare(f.run.id,['SP000009'],{previewOnly:true});
 assert.equal(p.previewOnly,true);assert.equal(p.id,undefined);assert.equal(p.items[0].sapo.variantId,900);
 assert.equal(p.items[0].row.price,32400000);assert.match(p.items[0].sapo.notePreview,/HTML gốc/);
 assert.deepEqual(f.sim.state,before);assert.deepEqual(f.sapo.state,sapoBefore);assert.equal(f.calls.length,0);
 await assert.rejects(f.live.commit(p.id,true));assert.equal(f.calls.length,0);
});
test('renamed Kiot code finds its Sapo SKU; two Kiot codes on one base are refused',async()=>{
 const f=await fixture(2);f.products[0].code='SP000009_23092026';await f.live.refresh();const run=await f.sim.run();
 const p=await f.live.prepare(run.id,['SP000009_23092026'],{previewOnly:true});assert.equal(p.items[0].sapo.variantId,900);assert.equal(p.items[0].sapo.code,'SP000009');
 f.products[1].code='SP000009_KG';await f.live.refresh();const again=await f.sim.run();
 await assert.rejects(f.live.prepare(again.id,['SP000009_23092026'],{previewOnly:true}),/cùng gốc SP000009/);
 assert.equal(f.calls.length,0);
});
test('update preflight reads Kiot and Sapo of a product at the same time',async()=>{
 const f=await fixture(1);const p=await f.prepare();
 // The first two reads are the preflight (one Kiot, one Sapo); they must overlap.
 let open=0,started=0,overlap=false;const slow=fn=>async(...args)=>{open++;started++;if(open>1&&started<=2)overlap=true;await new Promise(r=>setTimeout(r,20));open--;return fn(...args);};
 f.kiot.product=slow(f.kiot.product);f.sc.product=slow(f.sc.product);
 const update=await f.live.commit(p.id,true);assert.equal(update.outcome,'success');assert.ok(overlap,'Kiot and Sapo preflight reads overlap');
});
test('preview rejects a stale catalog and a changed Kiot product',async()=>{
 const f=await fixture(1);f.sapo.state.catalogBinding='old';
 await assert.rejects(f.live.prepare(f.run.id,['SP000009'],{previewOnly:true}),/chỉ mục/);
 f.sapo.state.catalogBinding='fake';f.products[0].currentPrice++;
 await assert.rejects(f.live.prepare(f.run.id,['SP000009'],{previewOnly:true}),/Kiot đã thay đổi \(giá\); bấm Tải lại từ Kiot/);
 f.products[0].code='SP000009_23092026';f.products[0].name+=' x';
 await assert.rejects(f.live.prepare(f.run.id,['SP000009'],{previewOnly:true}),/Kiot đã thay đổi \(mã thành SP000009_23092026, tên, giá\)/);
 assert.equal(f.calls.length,0);
});
test('SP000009 uses different IDs, only selected product changes, checkpoints precede both PUTs',async()=>{
 const f=await fixture(),other=structuredClone(f.products[1]),sother=structuredClone(f.sapos[1]);const proposal=await f.prepare(['SP000009']);assert.equal(proposal.items[0].sapo.variantId,900);
 for(const [name,client] of [['kiot',f.kiot],['sapo',f.sc]]){const original=client.update;client.update=async(...args)=>{const disk=await f.store.read();assert.equal(disk.updates[0].items[0].platforms[name].status,'sending');return original(...args);};}
 const u=await f.live.commit(proposal.id,true);assert.equal(u.mode,'joint-v1');assert.equal(u.outcome,'success');assert.equal(f.products[0].currentPrice,u.items[0].row.price);assert.equal(f.sapos[0].variants[0].price,u.items[0].row.price);assert.deepEqual(f.products[1],other);assert.deepEqual(f.sapos[1],sother);
 assert.ok(f.sapos[0].content.startsWith('<b>HTML gốc</b>'));await assert.rejects(f.live.commit(proposal.id,true),/hợp lệ/);
});
test('Sapo and Kiot descriptions are identical with exactly current line and one event',async()=>{
 const f=await fixture(1);f.products[0].notes='<p>Mã định danh BaoQ Luxury: SP000009_BAG-GG</p><p>Lịch sử cũ</p>';
 await f.live.refresh();const run=await f.sim.run();
 const p=await f.live.prepare(run.id,['SP000009']);
 assert.match(p.items[0].sapo.notePreview,/BAOQ \| M3/);assert.ok(!p.items[0].sapo.notePreview.includes('Mã định danh BaoQ Luxury'));
 const u=await f.live.commit(p.id,true);assert.equal(u.outcome,'success');
 assert.match(f.products[0].notes,/Mã định danh BaoQ Luxury|Lịch sử cũ/);
 assert.doesNotMatch(f.sapos[0].content,/Mã định danh BaoQ Luxury|Lịch sử cũ/);assert.equal((f.sapos[0].content.match(/<p[ >]/g)||[]).length,2);
 assert.match(f.sapos[0].content,/2027-01-22 10:00/);assert.match(f.sapos[0].content,/Đã áp dụng M3/);
 assert.ok(f.sapos[0].content.startsWith('<b>HTML gốc</b>'));
});
test('both PUT workers start before either finishes',async()=>{
 const f=await fixture(1),p=await f.prepare();let release;const gate=new Promise(r=>release=r);const started=[];
 for(const [name,client] of [['kiot',f.kiot],['sapo',f.sc]]){const original=client.update;client.update=async(...a)=>{started.push(name);if(started.length===2)release();await gate;return original(...a);};}
 const u=await f.live.commit(p.id,true);assert.deepEqual(started.sort(),['kiot','sapo']);assert.equal(u.outcome,'success');
});
test('Sapo timeout has no readback/retry; Kiot continues all selected products',async()=>{
 const f=await fixture(),p=await f.prepare();let timedout=false,readsAfter=0;const read=f.sc.product;f.sc.product=async id=>{if(timedout)readsAfter++;return read(id);};f.sc.update=async()=>{timedout=true;throw Object.assign(Error('hết thời gian chờ'),{uncertain:true});};
 const u=await f.live.commit(p.id,true);assert.equal(u.platformSummary.kiot.succeeded,2);assert.equal(u.platformSummary.sapo.succeeded,0);assert.equal(u.items[0].platforms.sapo.status,'unknown');assert.equal(u.items[1].platforms.sapo.status,'not_sent');assert.equal(readsAfter,0);assert.equal(u.outcome,'partial_failure');
});
test('Sapo preflight conflict and journal failure prevent both writes',async()=>{
 const f=await fixture(),p=await f.prepare();f.sapos[1].content+='changed';const u=await f.live.commit(p.id,true);assert.equal(u.outcome,'preflight_failed');assert.equal(f.calls.length,0);
 const g=await fixture(1),q=await g.prepare();g.store.write=async()=>{throw Error('disk failed');};await assert.rejects(g.live.commit(q.id,true),/disk failed/);assert.equal(g.calls.length,0);
});
test('manual mapping is not required for confirmed joint write; stale catalog still blocks',async()=>{
 const f=await fixture(1);f.sapo.state.mapping=null;f.sim.state.mapping=null;
 const p=await f.prepare();assert.equal(f.calls.length,0);
 await assert.rejects(f.live.commit(p.id,false),/xác nhận/);assert.equal(f.calls.length,0);
 const u=await f.live.commit(p.id,true);assert.equal(u.outcome,'success');assert.equal(f.calls.length,2);
 const g=await fixture(1);g.sapo.state.catalogBinding='old';await assert.rejects(g.prepare(),/chỉ mục/);assert.equal(g.calls.length,0);
});
test('production app with Sapo writes enabled fails closed without Sapo; rejects mixed real/fake clients',async()=>{
 const app=await createTestApp({store:memory(),liveStore:memory(),sapoStore:memory(),source:{load:async()=>[]},client:{},sapoWrite:true});
 assert.equal(app.live.requireJoint,true);await assert.rejects(app.live.prepare('x',['SP000009']),/Sapo/);
 await assert.rejects(createSaleAi({store:memory(),liveStore:memory(),sapoStore:memory(),fixture:true,sapoClient:{}}),/giả lập/);
});
test('restart marks each unfinished platform unknown and never resumes writes',async()=>{
 const f=await fixture(1),p=await f.prepare(),u=await f.live.commit(p.id,true);const saved=await f.store.read();
 saved.updates[0].attempts[0].status='running';saved.updates[0].items[0].platforms.sapo.status='sending';await f.store.write(saved);
 const sim=new Simulator(f.store,{load:async()=>[]},f.sim.clock);await sim.initialize();
 assert.equal(sim.state.updates[0].outcome,'interrupted');assert.equal(sim.state.updates[0].items[0].platforms.sapo.status,'unknown');assert.equal(sim.state.updates[0].items[0].platforms.kiot.status,'done');assert.equal(f.calls.length,2);
});
test('serialized checkpoint publications are independent; drafts and history stay isolated',async()=>{
 const f=await fixture(1),before=structuredClone(f.sim.state),p=await f.prepare();assert.deepEqual(f.sim.state.runs,before.runs);
 const published=[],original=f.store.write;let active=0,max=0;
 f.store.write=async s=>{active++;max=Math.max(max,active);const captured=structuredClone(s);await new Promise(r=>setTimeout(r,1));assert.deepEqual(s,captured);published.push(captured);await original(s);active--;};
 await f.live.commit(p.id,true);assert.equal(max,1);assert.deepEqual(f.sim.state.runs.slice(1),before.runs);assert.equal(published[0].updates[0].items[0].platforms.kiot.status,'journaled');
});
test('shared Sapo product preserves source description and both SKU additions',async()=>{
 const f=await fixture();f.sapos[0].variants.push(f.sapos[1].variants[0]);f.sapos.splice(1);await f.sapo.refresh();
 const p=await f.prepare();const u=await f.live.commit(p.id,true);assert.equal(u.outcome,'success');
 assert.ok(f.sapos[0].content.startsWith('<b>HTML gốc</b>'));assert.equal((f.sapos[0].content.match(/<!--BAOQ-SKU-/g)||[]).length,2);
});

test('Kiot failure stops only Kiot, Sapo completes; cancel leaves both unchanged',async()=>{
 const f=await fixture(),before=structuredClone(f.products),spBefore=structuredClone(f.sapos),p=await f.prepare();await f.live.cancel(p.id);assert.deepEqual(f.products,before);assert.deepEqual(f.sapos,spBefore);
 const q=await f.prepare();f.kiot.update=async()=>{throw Error('Kiot rejected');};const u=await f.live.commit(q.id,true);assert.equal(u.platformSummary.sapo.succeeded,2);assert.equal(u.items[1].platforms.kiot.status,'not_sent');
});
test('definitive Sapo HTTP rejection is failure rather than unknown',async()=>{
 const f=await fixture(1),p=await f.prepare();f.sc.update=async()=>{throw Object.assign(Error('Sapo PUT: HTTP 422'),{httpStatus:422,uncertain:false});};const u=await f.live.commit(p.id,true);assert.equal(u.items[0].platforms.sapo.status,'write_failed');assert.equal(u.items[0].platforms.kiot.status,'done');
});
test('HTTP 408 write timeout remains unknown without readback',async()=>{
 const f=await fixture(1),p=await f.prepare();f.sc.update=async()=>{throw Object.assign(Error('Sapo PUT: HTTP 408'),{httpStatus:408,uncertain:true});};const u=await f.live.commit(p.id,true);assert.equal(u.items[0].platforms.sapo.status,'unknown');
});
test('definitive Kiot HTTP rejection is failure while Sapo continues',async()=>{
 const f=await fixture(1),p=await f.prepare(),adapter=new KiotClient({credentials:{retailer:'baoqluxury',client:'FAKE',secret:'FAKE'},fetcher:async()=>({ok:false,status:422})});adapter.token='FAKE';adapter.expires=Date.now()+60000;f.kiot.update=(...args)=>adapter.update(...args);const u=await f.live.commit(p.id,true);assert.equal(u.items[0].platforms.kiot.status,'write_failed');assert.equal(u.items[0].platforms.sapo.status,'done');
});
test('production app defaults to Kiot + Sapo price with Sapo description untouched',async()=>{
 const app=await createTestApp({store:memory(),liveStore:memory(),sapoStore:memory(),source:{load:async()=>[]},client:{}});
 assert.equal(app.live.sapoWrite,true);assert.equal(app.live.requireJoint,true);assert.equal(app.live.sapoDescription,false);
 app.server.close?.();
});
test('Kiot-only update never reads or writes Sapo and can be restored on Kiot',async()=>{
 const f=await fixture(1);f.live.sapoWrite=false;f.live.requireJoint=false;
 const original=structuredClone(f.products[0]),sapoOriginal=structuredClone(f.sapos[0]);
 let sapoReads=0;const product=f.sc.product;f.sc.product=async id=>{sapoReads++;return product(id);};
 const p=await f.prepare();assert.deepEqual(p.platforms,['kiot']);assert.equal(p.items[0].sapo,undefined);
 const u=await f.live.commit(p.id,true);assert.equal(u.outcome,'success');assert.equal(u.mode,'joint-v1');assert.equal(u.label,'Cập nhật Kiot');
 assert.deepEqual(Object.keys(u.items[0].platforms),['kiot']);assert.deepEqual(Object.keys(u.platformSummary),['kiot']);
 assert.deepEqual(f.calls,['kiot:SP000009']);assert.deepEqual(f.sapos[0],sapoOriginal);assert.equal(sapoReads,0);
 assert.equal(f.products[0].currentPrice,32400000);
 const r=await f.live.prepareRestore(u.id);assert.deepEqual(r.tasks.map(t=>t.name),['kiot']);assert.equal(r.items[0].sapo,undefined);
 const restored=await f.live.commitRestore(r.id,true);assert.equal(restored.outcome,'success');assert.equal(restored.label,'Khôi phục Kiot');
 assert.equal(f.products[0].currentPrice,original.currentPrice);assert.equal(f.products[0].notes,original.notes);
 assert.deepEqual(f.calls,['kiot:SP000009','kiot:SP000009']);assert.deepEqual(f.sapos[0],sapoOriginal);assert.equal(sapoReads,0);
});
test('Sapo price-only mode updates Sapo price, leaves description and restores price',async()=>{
 const f=await fixture(1);f.live.sapoDescription=false;const sapoOriginal=structuredClone(f.sapos[0]),kiot=structuredClone(f.products[0]);
 let sent;const update=f.sc.update;f.sc.update=async(...args)=>{sent=args;return update(...args);};
 const p=await f.prepare();assert.equal(p.items[0].sapo.keepContent,true);assert.equal(p.items[0].sapo.notePreview,sapoOriginal.content);
 const u=await f.live.commit(p.id,true);assert.equal(u.outcome,'success');assert.equal(sent[3],null);
 assert.equal(f.sapos[0].variants[0].price,32400000);assert.equal(f.sapos[0].content,sapoOriginal.content);
 assert.equal(f.products[0].currentPrice,32400000);assert.notEqual(f.products[0].notes,kiot.notes);
 const r=await f.live.prepareRestore(u.id);assert.equal((await f.live.commitRestore(r.id,true)).outcome,'success');
 assert.deepEqual(f.sapos[0],sapoOriginal);assert.equal(f.products[0].currentPrice,kiot.currentPrice);assert.equal(f.products[0].notes,kiot.notes);
});
