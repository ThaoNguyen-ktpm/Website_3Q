import test from 'node:test';
import {summaryText} from '../lib/update-report.js';
import assert from 'node:assert/strict';
import {fixture} from './joint-update.test.js';
import {Simulator} from '../lib/service.js';
test('confirmed restore returns both real-adapter prices and descriptions to the pre-update snapshot',async()=>{
 const f=await fixture(1),kiot=structuredClone(f.products[0]),sapo=structuredClone(f.sapos[0]);
 const p=await f.prepare();const update=await f.live.commit(p.id,true);
 assert.ok(f.products[0].notes.startsWith('<!--BAOQ-CURRENT-->'));assert.ok(f.products[0].notes.endsWith(kiot.notes));
 const preview=await f.live.prepareRestore(update.id);assert.equal(preview.items[0].row.price,kiot.currentPrice);
 await assert.rejects(f.live.commitRestore(preview.id,false),/xác nhận/);
 const restored=await f.live.commitRestore(preview.id,true);assert.equal(restored.outcome,'success');
 assert.equal(f.products[0].currentPrice,kiot.currentPrice);assert.equal(f.products[0].notes,kiot.notes);assert.deepEqual(f.sapos[0],sapo);
 assert.equal(f.sim.state.products[0].p0,kiot.currentPrice);
 await assert.rejects(f.live.prepareRestore(update.id),/khôi phục/);
});
test('restore works when the Kiot code carries a suffix and Sapo keeps the code before "_"',async()=>{
 const f=await fixture(1);f.products[0].code='SP000009_23092026';await f.live.refresh();const run=await f.sim.run();
 const kiot=structuredClone(f.products[0]),sapo=structuredClone(f.sapos[0]);
 const p=await f.live.prepare(run.id,['SP000009_23092026']);const update=await f.live.commit(p.id,true);assert.equal(update.outcome,'success');
 const preview=await f.live.prepareRestore(update.id);const restored=await f.live.commitRestore(preview.id,true);assert.equal(restored.outcome,'success');
 assert.equal(f.products[0].currentPrice,kiot.currentPrice);assert.deepEqual(f.sapos[0],sapo);
});
test('outside edits and changed store binding block restore before writes',async()=>{
 const f=await fixture(1),p=await f.prepare(),u=await f.live.commit(p.id,true),count=f.calls.length;
 f.products[0].notes+=' ngoài luồng';await assert.rejects(f.live.prepareRestore(u.id),/thay đổi/);assert.equal(f.calls.length,count);
 f.products[0].notes=u.items[0].desiredNote;f.sapo.binding='new';await assert.rejects(f.live.prepareRestore(u.id),/cấu hình/);assert.equal(f.calls.length,count);
});
test('restore rechecks after preview; conflict prevents writes on either side',async()=>{
 const f=await fixture(1),p=await f.prepare(),u=await f.live.commit(p.id,true),preview=await f.live.prepareRestore(u.id),count=f.calls.length;
 f.sapos[0].content+=' edit';const result=await f.live.commitRestore(preview.id,true);assert.equal(result.outcome,'preflight_failed');assert.equal(f.calls.length,count);
});
test('shared Sapo description restores once with both original variant prices',async()=>{
 const f=await fixture();f.sapos[0].variants.push(f.sapos[1].variants[0]);f.sapos.splice(1);await f.sapo.refresh();const original=structuredClone(f.sapos[0]);
 const p=await f.prepare(),u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id);
 assert.equal(r.tasks.filter(t=>t.name==='sapo').length,1);const before=f.calls.length;
 assert.equal((await f.live.commitRestore(r.id,true)).outcome,'success');assert.deepEqual(f.sapos[0],original);assert.equal(f.calls.length-before,3);
});
test('a restore timeout stops that platform without retry/readback; other platform restores',async()=>{
 const f=await fixture(),p=await f.prepare(),u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id);let timedOut=false,readsAfter=0,calls=0;
 const read=f.kiot.product;f.kiot.product=async id=>{if(timedOut)readsAfter++;return read(id);};
 f.kiot.update=async()=>{calls++;timedOut=true;throw Object.assign(Error('timeout'),{uncertain:true});};
 const result=await f.live.commitRestore(r.id,true);assert.equal(result.platformSummary.sapo.succeeded,2);assert.equal(result.items[0].platforms.kiot.status,'unknown');assert.equal(result.items[1].platforms.kiot.status,'not_sent');assert.equal(calls,1);assert.equal(readsAfter,0);
 await assert.rejects(f.live.prepareRestore(u.id),/khôi phục/);
});
test('persisted before-images survive restart and interrupted restore never resumes writes',async()=>{
 const f=await fixture(1),p=await f.prepare(),u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id);
 const s=new Simulator(f.store,{load:async()=>[]},f.sim.clock);await s.initialize();assert.equal(s.state.updates[0].restoreVersion,1);assert.equal(s.state.prepared[0].id,r.id);
 const disk=await f.store.read();disk.updates.unshift({id:'restore-interrupted',mode:'restore-joint-v1',sourceId:u.id,at:'2027-01-22T03:00:00Z',items:[{code:'SP000009',status:'journaled',platforms:{kiot:{status:'sending',requestSent:true},sapo:{status:'journaled'}}}],attempts:[{status:'running'}]});await f.store.write(disk);
 const n=new Simulator(f.store,{load:async()=>[]},f.sim.clock);await n.initialize();assert.equal(n.state.updates[0].items[0].platforms.kiot.status,'unknown');assert.equal(n.state.updates[0].items[0].platforms.sapo.status,'unknown');assert.equal(f.calls.length,2);
});
test('failed journal blocks all restore requests; unknown original writes are not auto-restored',async()=>{
 const f=await fixture(1),p=await f.prepare(),u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id),count=f.calls.length;let saves=0;const original=f.store.write;
 f.store.write=async state=>{if(++saves===2)throw Error('disk failure');return original(state);};
 await assert.rejects(f.live.commitRestore(r.id,true),/disk failure/);assert.equal(f.calls.length,count);
 const g=await fixture(1),q=await g.prepare();g.sc.update=async()=>{throw Object.assign(Error('timeout'),{uncertain:true});};const unknown=await g.live.commit(q.id,true);
 // Bảo 2026-10-20: the unknown Sapo write is not restored; the verified Kiot write still is.
 const back=await g.live.prepareRestore(unknown.id);assert.deepEqual(back.tasks.map(t=>t.name),['kiot']);assert.equal(back.items[0].restoreSapo,false);
});
test('rollback restores every verified product; one edited by hand is skipped on both sides and listed (Bảo 2026-10-20)',async()=>{
 const f=await fixture(2),p=await f.prepare(),u=await f.live.commit(p.id,true);
 const edited=f.products[0].notes+=' sửa tay',sapoEdited=structuredClone(f.sapos[0]);
 const r=await f.live.prepareRestore(u.id);assert.deepEqual(r.skipped.map(x=>[x.code,x.error]),[['SP000009','Đã thay đổi sau cập nhật; không ghi đè']]);
 const back=await f.live.commitRestore(r.id,true);
 assert.equal(f.products[0].notes,edited);assert.deepEqual(f.sapos[0],sapoEdited);
 assert.equal(f.products[1].currentPrice,35e6);assert.equal(f.sapos[1].variants[0].price,35e6);
 assert.equal(back.outcome,'success');assert.match(summaryText(back.summary,back),/Kiot: thành công 1 sản phẩm. Sapo: thành công 1 sản phẩm. Không gửi cập nhật 1 sản phẩm/);
 f.products[1].notes+=' sửa';await assert.rejects(f.live.prepareRestore(u.id),/không có món nào khôi phục được|đã có yêu cầu khôi phục/);
});
test('partial update restores only verified successful platform',async()=>{
 const f=await fixture(1),before=structuredClone(f.products[0]),sp=structuredClone(f.sapos[0]),p=await f.prepare();f.sc.update=async()=>{throw Object.assign(Error('rejected'),{httpStatus:422,uncertain:false});};
 const u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id);assert.equal(r.tasks.length,1);const restored=await f.live.commitRestore(r.id,true);assert.equal(restored.outcome,'success');assert.equal(restored.platformSummary.kiot.succeeded,1);assert.deepEqual(restored.platformSummary.sapo,{total:0,succeeded:0,failed:0});assert.equal(restored.items[0].platforms.sapo.status,'skipped');assert.equal(f.products[0].currentPrice,before.currentPrice);assert.equal(f.products[0].notes,before.notes);assert.deepEqual(f.sapos[0],sp);
});
test('verification GET rejection after a successful restore PUT remains unknown',async()=>{
 const f=await fixture(1),p=await f.prepare(),u=await f.live.commit(p.id,true),r=await f.live.prepareRestore(u.id);let wrote=false;
 const read=f.kiot.product,write=f.kiot.update;
 f.kiot.update=async(...args)=>{const result=await write(...args);wrote=true;return result;};
 f.kiot.product=async id=>{if(wrote)throw Object.assign(Error('verification forbidden'),{httpStatus:403,uncertain:false});return read(id);};
 const result=await f.live.commitRestore(r.id,true);assert.equal(result.items[0].platforms.kiot.status,'unknown');assert.equal(result.platformSummary.sapo.succeeded,1);
});
