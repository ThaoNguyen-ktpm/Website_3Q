import {createHash} from 'node:crypto';
import {calculate,POLICY,vietnamTime} from './pricing.js';
import {sapoFingerprint,sapoNote,hasSapoZeroPrice,skipSapoZeroPrice} from './sapo.js';
import {stopsPlatform} from './update-errors.js';
import {platformNames,summarize} from './joint-update.js';
import {liveNote} from './live.js';

// Bảo 2026-10-20 (TASK-102): "cập nhật toàn bộ" ~5.000 products in ≤30 minutes under KiotViet's 5.000 GET/hour.
// Kiot: products are checked from list reads (no GET per product), written 50 per bulk PUT (/listupdatedproducts) and
// verified one by one from the list of products modified since the lot was sent. Sapo has no bulk API: per product,
// a few lanes, variants of one Sapo product in one lane. Rules kept from executeJoint: a product edited after the check
// is never overwritten, nothing is resent, and the journal marks a whole lot "sending" before any request of that lot.
// Public API section 2.4.8 documents the bulk endpoint but no larger supported limit; retain 50.
export const LOT_SIZE=50, SAPO_LANES=3;
// Clock skew allowance between this machine and Kiot for lastModifiedFrom reads.
export const MODIFIED_MARGIN_MS=30000;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const rejectedHttp=e=>e.httpStatus>=400&&e.httpStatus<500&&e.httpStatus!==408&&e.uncertain!==true;

export async function executeBatchJoint(service,state,update){
 const names=platformNames(update),withSapo=names.includes('sapo'),wait=service.sleep||sleep;
 const now=()=>service.clock().getTime();
 const timingStart=now(),timings={initialReadMs:0,lots:[],journalMs:0,totalMs:0,reads:0,writes:0};
 if(service.sim.liveScope)service.sim.liveScope.timings.batch=timings;
 let lotTiming;
 let tail=Promise.resolve(),saveError;
 const save=()=>{const pending=tail.then(async()=>{if(saveError)throw saveError;summarize(update);const start=now();try{await service.checkpoint(state,update);}catch(e){saveError=e;throw e;}finally{const ms=now()-start;timings.journalMs+=ms;if(lotTiming)lotTiming.journalMs+=ms;}});tail=pending.catch(()=>{});return pending;};
 const open=name=>update.items.filter(i=>i.platforms[name]&&i.platforms[name].status!=='done');
 const stages=Object.fromEntries(names.map(name=>[name,{stage:'Đang đối chiếu',processed:0,total:open(name).length}]));
 service.operation.platforms=stages;
 const stage=(name,text)=>{stages[name].stage=text;service.stage(text);};
 const progress=service.operation.batch={lot:0,lots:0,total:update.items.length,done:0,failed:0,unknown:0,etaSeconds:null,startedAt:service.clock().toISOString(),pause:null,kiotReads:0,kiotWrites:0,unchanged:update.unchanged||0};
 const count=()=>{progress.unchanged=(update.unchanged||0)+update.items.filter(i=>Object.values(i.platforms).every(p=>p.status==='unchanged')).length;
  progress.done=update.items.filter(i=>Object.values(i.platforms).every(p=>['done','unchanged'].includes(p.status))&&Object.values(i.platforms).some(p=>p.status==='done')).length;
  progress.unknown=update.items.filter(i=>Object.values(i.platforms).some(p=>p.status==='unknown')).length;
  progress.failed=update.items.filter(i=>Object.values(i.platforms).some(p=>['write_failed','preflight_failed','not_sent'].includes(p.status))).length;};

 // Local checks only (no network): policy, P0 and the price row must still be the ones confirmed.
 const today=vietnamTime(service.clock()).date;
 for(const item of update.items){
  const pending=Object.values(item.platforms).filter(p=>p.status!=='done');if(!pending.length)continue;
  try{
   const local=state.products.find(p=>p.id===item.id);const row=calculate(local,today);
   const key=createHash('sha256').update(JSON.stringify([local.p0,local.manualPricing])).digest('hex');
   if(state.policy!==POLICY||key!==item.row.localKey||row.status!=='simulated'||row.price!==item.row.price||row.allowance!==item.row.allowance)throw Error('Điều kiện hoặc mốc M thay đổi');
   for(const p of pending)p.status='ready';
  }catch(e){for(const p of pending){p.status='preflight_failed';p.error=e.message;}}
 }
 // A local-only proposal may be much older than the modified-since cursor.
 // Read the current list at the send gate so older hand edits cannot be missed.
 // TASK-122: the cursor now comes from the table's authoritative read, never confirmation time.
 const trustedCursor=Number.isFinite(Date.parse(update.listAt))&&Date.parse(update.listAt)<=now();
 await save();
 if(update.localOnly&&!trustedCursor){
  const start=now();
  stage('kiot','Đang đọc toàn bộ Kiot (~30 giây) vì bảng chưa có mốc; bấm Tải lại từ Kiot để lần sau nhanh hơn');
  const fresh=new Map((await service.timed('GET LIST',()=>service.client.all())).map(p=>[p.id,p]));
  progress.kiotReads+=service.client.lastPages||1;
  timings.initialReadMs+=now()-start;
  for(const item of update.items){
   try{if(!fresh.has(item.id))throw Error('Kiot không còn trong danh sách');service.checkKiotSnapshot(state,item,fresh.get(item.id));item.before=structuredClone(fresh.get(item.id));}
   catch(e){for(const p of Object.values(item.platforms))if(p.status==='ready'){p.status='preflight_failed';p.error=e.message;p.requestSent=false;}}
  }
 }

 const side=Object.fromEntries(names.map(name=>[name,{stopped:false,pauseUntil:0}]));
 const pauseFor=(name,e)=>{const seconds=Number(e?.retryAfter)>0?Number(e.retryAfter):15;side[name].pauseUntil=Math.max(side[name].pauseUntil,now()+seconds*1000);
  progress.pause={side:name,seconds,until:new Date(side[name].pauseUntil).toISOString()};};
 const waitPause=async name=>{while(side[name].pauseUntil>now()){stage(name,name==='sapo'?'Đang chờ giới hạn Sapo…':'Đang tạm nghỉ vì quá giới hạn');await wait(side[name].pauseUntil-now());}if(progress.pause?.side===name&&now()>=side[name].pauseUntil)progress.pause=null;};
 const notSent=(p,error)=>{if(['ready','sending'].includes(p.status)){p.status='not_sent';p.error=error;p.requestSent=false;}};

 // Products modified on Kiot since the last read: used to verify the lot just sent and to catch edits of later lots.
 const latest=new Map();let cursor=trustedCursor?Date.parse(update.listAt):now(),readOk=false;
 const readModified=async(initial=false)=>{
  const since=new Date(cursor-MODIFIED_MARGIN_MS).toISOString(),started=now();
  for(let attempt=1;;attempt++){
   await waitPause('kiot');
   const start=now();
   try{const list=await service.timed('GET LIST',()=>service.client.listModified(since));progress.kiotReads+=service.client.lastPages||1;
    const map=new Map(list.map(p=>[p.id,p]));for(const [id,p] of map)latest.set(id,p);cursor=started;readOk=true;return map;}
   // Reads are safe to repeat after a 429 pause; writes never are.
   catch(e){if(e.httpStatus===429&&attempt<3){pauseFor('kiot',e);continue;}readOk=false;throw e;}
   finally{const ms=now()-start;if(initial)timings.initialReadMs+=ms;else if(lotTiming)lotTiming.listModifiedMs+=ms;}
  }
 };

 const work=update.items.filter(i=>Object.values(i.platforms).some(p=>p.status==='ready'));
 const lots=[];for(let i=0;i<work.length;i+=LOT_SIZE)lots.push(work.slice(i,i+LOT_SIZE));
 progress.lots=lots.length;
 const durations=[];const expected=new Map();

 const kiotLot=async items=>{
  if(!items.length)return;
  if(side.kiot.stopped){for(const i of items)notSent(i.platforms.kiot,'Không cập nhật — bên này đã dừng');return;}
  await waitPause('kiot');stage('kiot','Đang gửi lô giá Kiot');
  const putStart=now();
  try{progress.kiotWrites++;await service.timed('PUT LIST',()=>service.client.updateMany(items.map(i=>({product:i.before,fields:{basePrice:i.row.price,...(update.kiotDescription!==false?{description:i.desiredNote}:{})}}))));}
  catch(e){
   for(const i of items){const p=i.platforms.kiot;p.status=rejectedHttp(e)?'write_failed':'unknown';p.error=e.message;p.failureStage=update.kiotDescription===false?'Gửi giá':'Gửi lô giá và mô tả';}
   if(e.httpStatus===429)pauseFor('kiot',e);if(stopsPlatform(e))side.kiot.stopped=true;
   // Timeout or server error: unknown, no read-back and no resend (same as single-product writes).
   return;
  }
  finally{if(lotTiming)lotTiming.putMs+=now()-putStart;}
  stage('kiot','Đang xác minh lô Kiot');
  let after;
  try{after=await readModified();}
  catch(e){for(const i of items){const p=i.platforms.kiot;p.status='unknown';p.error='Không đọc lại được để xác minh: '+e.message;p.failureStage='Xác minh sau ghi';}if(stopsPlatform(e))side.kiot.stopped=true;return;}
  for(const i of items){
   const p=i.platforms.kiot,actual=after.get(i.id);
   if(actual&&actual.currentPrice===i.row.price&&actual.notes===i.desiredNote){
    service.syncKiotProduct(state,actual,i.id);p.afterProduct=structuredClone(actual);p.status='done';p.verifiedAt=service.clock().toISOString();stages.kiot.processed++;
   }else{p.status='unknown';p.error='Không xác minh được sau khi gửi';p.failureStage='Xác minh sau ghi';}
  }
 };

 const sapoOne=async item=>{
  const p=item.platforms.sapo;let sending=false;
  if(side.sapo.stopped){notSent(p,'Không cập nhật — bên này đã dừng');return;}
  try{
   if(saveError)throw saveError;
   await waitPause('sapo');service.sapo.requireVerified();
   const fresh=await service.timed('SAPO GET',()=>service.sapo.read(item.sapo));
   const before=expected.get(item.sapo.productId)||item.sapo.before;
   if(!before&&!update.localOnly)throw Error('Thiếu bản đối chiếu Sapo');
   if(before&&sapoFingerprint(fresh)!==sapoFingerprint(before))throw Error('Sapo thay đổi trước khi gửi');
   if(!item.sapo.before){item.sapo.before=structuredClone(fresh);item.sapo.fingerprint=sapoFingerprint(fresh);await save();}
   const desired=service.sapoDescription===false?null:sapoNote(fresh.content,item.row,item.desiredNote);
   sending=true;p.stage='Gửi giá và mô tả';
   await service.timed('SAPO PUT',()=>service.sapo.client.update(item.sapo.productId,item.sapo.variantId,item.row.price,desired));
   p.stage='Xác minh sau ghi';
   const actual=await service.timed('SAPO GET',()=>service.sapo.read(item.sapo));
   if(actual.variants.find(v=>v.id===item.sapo.variantId)?.price!==item.row.price||actual.content!==(desired??fresh.content))throw Error('Sapo: giá/mô tả đọc lại không khớp');
   expected.set(item.sapo.productId,actual);p.afterProduct=structuredClone(actual);p.status='done';p.verifiedAt=service.clock().toISOString();stages.sapo.processed++;
  }catch(e){
   const rejected=p.stage==='Gửi giá và mô tả'&&rejectedHttp(e);
   p.status=sending&&!rejected?'unknown':'write_failed';p.error=e.message;p.failureStage=p.stage;if(!sending)p.requestSent=false;
   if(e.httpStatus===429){if(sending&&rejected)p.error='Sapo quá giới hạn — chưa ghi';pauseFor('sapo',e);}if(stopsPlatform(e))side.sapo.stopped=true;
  }
 };
 const sapoLot=async items=>{
  if(!items.length)return;stage('sapo','Đang gửi giá Sapo');
  // Variants of one Sapo product share its description: same lane, in order.
  const groups=new Map();for(const i of items){const k=i.sapo.productId;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
  const queue=[...groups.values()];
  await Promise.all(Array.from({length:Math.min(SAPO_LANES,queue.length)},async()=>{while(queue.length){const group=queue.shift();for(const i of group)await sapoOne(i);}}));
 };

 for(const [index,lot] of lots.entries()){
  const started=now();progress.lot=index+1;
  lotTiming={lot:index+1,putMs:0,listModifiedMs:0,journalMs:0};timings.lots.push(lotTiming);
  // Kiot edits since the check: from the previous read, or a fresh one when there is none.
  if(names.includes('kiot')&&!side.kiot.stopped&&!readOk){
   try{stage('kiot','Đang kiểm tra Kiot trước khi gửi');await readModified(index===0);}
   catch(e){if(stopsPlatform(e))side.kiot.stopped=true;
    for(const i of lot)for(const p of Object.values(i.platforms))if(p.status==='ready'){p.status='preflight_failed';p.error='Không kiểm tra được Kiot trước khi gửi: '+e.message;p.requestSent=false;}}
  }
  for(const i of lot){const c=latest.get(i.id)||i.before;
   if(!Object.values(i.platforms).some(p=>p.status==='ready'))continue;
   try{service.checkKiotSnapshot(state,i,c);
    if(update.kiotDescription===false&&c.currentPrice===i.row.price&&i.platforms.kiot?.status==='ready'){service.skipCorrectKiot(state,i,c);stages.kiot.processed++;}
   }catch(e){for(const p of Object.values(i.platforms))if(p.status==='ready'){p.status='preflight_failed';p.error=e.message;p.requestSent=false;}}
  }
  if(withSapo)for(const i of lot)if(Object.values(i.platforms).some(p=>p.status==='ready')){
   try{const fresh=await service.timed('SAPO GET',()=>service.sapo.read(i.sapo));if(hasSapoZeroPrice(fresh))skipSapoZeroPrice(i);}
   catch(e){for(const p of Object.values(i.platforms))if(p.status==='ready'){p.status='preflight_failed';p.error=e.message;p.requestSent=false;}}
  }
  const vn=vietnamTime(service.clock());
  for(const i of lot){i.actualAt=`${vn.date} ${vn.time} (giờ Việt Nam)`;i.desiredNote=update.kiotDescription===false?i.before.notes:liveNote(i.before.notes,i.row,i.key,i.actualAt);
   for(const [name,p] of Object.entries(i.platforms))if(p.status==='ready'){p.status='sending';p.stage=update.kiotDescription===false&&name==='kiot'?'Gửi giá':'Gửi giá và mô tả';p.requestSent=true;}}
  state.tableStale=true;service.stage('Đang lưu nhật ký');await save();
  readOk=false;
  await Promise.all([
   names.includes('kiot')?kiotLot(lot.filter(i=>i.platforms.kiot?.status==='sending')):null,
   withSapo?sapoLot(lot.filter(i=>i.platforms.sapo?.status==='sending')):null,
  ]);
  durations.push(now()-started);count();
  const recent=durations.slice(-3),average=recent.reduce((a,b)=>a+b,0)/recent.length;
  progress.etaSeconds=Math.ceil(average*(lots.length-index-1)/1000)+Math.max(0,Math.ceil((Math.max(...Object.values(side).map(s=>s.pauseUntil))-now())/1000));
 }
 for(const name of names)if(side[name].stopped)for(const i of update.items)notSent(i.platforms[name],'Không cập nhật — bên này đã dừng');
 await tail;if(saveError)throw saveError;
 summarize(update);count();progress.etaSeconds=0;
 update.outcome=update.items.every(i=>['done','unchanged','skipped_sapo_zero_price'].includes(i.status))?'success':'partial_failure';
 // Results of lot N are checkpointed with sending N+1; the last results/completed attempt
 // are persisted by the transaction before it resolves. No duplicate whole-state saves.
 timings.totalMs=now()-timingStart;timings.reads=progress.kiotReads;timings.writes=progress.kiotWrites;
}
