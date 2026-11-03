import {createHash} from 'node:crypto';
import {calculate,POLICY,vietnamTime} from './pricing.js';
import {liveNote} from './live.js';
import {sapoFingerprint,sapoNote,hasSapoZeroPrice,skipSapoZeroPrice} from './sapo.js';
import {updateSummary} from './update-report.js';
import {stopsPlatform} from './update-errors.js';
import {readPool} from './read-pool.js';
export function summarize(update){
 for(const item of update.items){item.status=Object.values(item.platforms).every(p=>p.status==='skipped_sapo_zero_price')?'skipped_sapo_zero_price':Object.values(item.platforms).every(p=>p.status==='unchanged')?'unchanged':Object.values(item.platforms).every(p=>['done','unchanged'].includes(p.status))?'done':Object.values(item.platforms).some(p=>p.status==='unknown')?'unknown':'write_failed';item.error=Object.entries(item.platforms).filter(([,p])=>!['done','unchanged'].includes(p.status)).map(([name,p])=>`${name==='kiot'?'Kiot':'Sapo'}: ${p.error||p.status}`).join('; ');}
 update.platformSummary=Object.fromEntries(platformNames(update).map(name=>[name,updateSummary(update.items.map(i=>i.platforms[name]))]));
}
// Kiot-only updates carry only the kiot platform; Sapo is skipped entirely.
export const platformNames=update=>update.targets||Object.keys(update.items[0]?.platforms||{kiot:{}});
// Products per journal save while writing (TASK-037).
export const JOURNAL_WINDOW=100;
export async function executeJoint(service,state,update){
 const names=platformNames(update),withSapo=names.includes('sapo');
 let tail=Promise.resolve(),saveError;
 // Serialize publication as well as disk writes. A failed journal closes the
 // send gate for both workers. Never run two manifest replacements concurrently.
 const save=()=>{const pending=tail.then(async()=>{if(saveError)throw saveError;summarize(update);try{await service.checkpoint(state,update);}catch(e){saveError=e;throw e;}});tail=pending.catch(()=>{});return pending;};
 const stages=Object.fromEntries(names.map(name=>[name,{stage:'Đang đối chiếu',processed:0,total:update.items.length}]));
 service.operation.platforms=stages;
 const stage=(name,text)=>{stages[name].stage=text;service.stage(text);};
 const readSapo=ref=>service.timed('SAPO GET',()=>service.sapo.read(ref));
 let failed=false;
 // Same checks per product; Kiot and Sapo are read together and two products at a time (each catches its own error).
 await readPool(update.items,async item=>{
  try{
   if(withSapo)service.sapo.requireVerified();const local=state.products.find(p=>p.id===item.id);const row=calculate(local,vietnamTime(service.clock()).date);
   const key=createHash('sha256').update(JSON.stringify([local.p0,local.manualPricing])).digest('hex');
   if(state.policy!==POLICY||key!==item.row.localKey||row.status!=='simulated'||row.price!==item.row.price||row.allowance!==item.row.allowance)throw Error('Điều kiện hoặc mốc M thay đổi');
   // Background preparation has no remote snapshot; each worker reads at its send gate.
   if(update.localOnly){const vn=vietnamTime(service.clock());item.actualAt=`${vn.date} ${vn.time} (giờ Việt Nam)`;item.desiredNote=update.kiotDescription===false?item.before.notes:liveNote(item.before.notes,item.row,item.key,item.actualAt);for(const p of Object.values(item.platforms))p.status='ready';return;}
   const reads=await Promise.allSettled([
    service.readProduct(item.id).then(fresh=>{service.checkKiotSnapshot(state,item,fresh);return fresh;}),
    ...(withSapo?[readSapo(item.sapo).then(sp=>{if(!hasSapoZeroPrice(sp)&&sapoFingerprint(sp)!==item.sapo.fingerprint)throw Error('Sapo thay đổi sau xác nhận');return sp;})]:[])
   ]);
   if(reads.some(r=>r.status==='rejected')){
    names.forEach((name,index)=>{const result=reads[index],p=item.platforms[name];p.requestSent=false;
     if(result.status==='rejected'){p.status='preflight_failed';p.error=result.reason.message;failed ||= !update.continueOnError||stopsPlatform(result.reason);}
     else{p.status='not_sent';p.error='Chưa gửi — đối chiếu bên còn lại chưa đạt';}
    });return;
   }
   if(withSapo&&hasSapoZeroPrice(reads[1].value)){skipSapoZeroPrice(item);return;}
   const fresh=reads[0].value;
   item.before=fresh;const vn=vietnamTime(service.clock());item.actualAt=`${vn.date} ${vn.time} (giờ Việt Nam)`;item.desiredNote=update.kiotDescription===false?item.before.notes:liveNote(fresh.notes,item.row,item.key,item.actualAt);
   for(const p of Object.values(item.platforms))p.status='ready';
  }catch(e){failed ||= !update.continueOnError||stopsPlatform(e);for(const p of Object.values(item.platforms)){p.status='preflight_failed';p.error=e.message;}}
 });
 if(failed){for(const item of update.items)for(const p of Object.values(item.platforms))if(p.status==='ready'){p.status='not_sent';p.error=withSapo?'Không cập nhật — kiểm tra hai bên thất bại':'Không cập nhật — kiểm tra trước ghi thất bại';}update.outcome='preflight_failed';await save();return;}
 await save();
 // Background workers advance together: the paired read is fresh at both send
 // gates, a conflict blocks both sides, and neither needs a second pre-write GET.
 const active=new Set(names),pairs=new Map(),barriers=new Map();
 const releaseBarriers=()=>{for(const [item,b] of barriers)if([...active].every(n=>b.done.has(n))){b.release();barriers.delete(item);pairs.delete(item);}};
 const arrived=(item,name)=>{if(!update.localOnly)return Promise.resolve();let b=barriers.get(item);if(!b){let release;const promise=new Promise(r=>{release=r;});b={done:new Set(),promise,release};barriers.set(item,b);}b.done.add(name);releaseBarriers();return b.promise;};
 const pair=item=>{
  if(!pairs.has(item))pairs.set(item,(async()=>{
   const result={};
   const reads=await Promise.allSettled([...active].map(async name=>{
    const fresh=name==='kiot'?await service.readProduct(item.id):await readSapo(item.sapo);
    if(name==='kiot')service.checkKiotSnapshot(state,item,fresh);
    if(name==='sapo'){
     service.sapo.requireVerified();
     if(item.sapo.before&&sapoFingerprint(fresh)!==item.sapo.fingerprint)throw Error('Sapo thay đổi trước khi gửi');
     item.sapo.before=structuredClone(fresh);item.sapo.fingerprint=sapoFingerprint(fresh);
    }
    result[name]=fresh;
   }));
   if(result.sapo&&hasSapoZeroPrice(result.sapo)){skipSapoZeroPrice(item);return null;}
   const error=reads.find(r=>r.status==='rejected');if(error)throw error.reason;
   return result;
  })());
  return pairs.get(item);
 };
 async function worker(name){
  try{
  let pauseUntil=0;const now=()=>service.clock().getTime(),wait=service.sleep||(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
  // Expected Sapo state tracks shared product descriptions between selected
  // variants; SKU-owned blocks preserve each variant's BAOQ section.
  const expected=new Map();
  // Bảo 2026-10-19 (TASK-037): the journal is saved once per window of products, not before and after every product.
  // The whole window is saved as "sending" first, so a crash shows those products unknown (never "not sent"); results
  // and errors of a window are saved with the next window or at the end.
  const queued=new Set();
  for(const item of update.items){
   const p=item.platforms[name];let sending=false;
   if(p.status!=='ready'&&!queued.has(item)){await arrived(item,name);continue;}
   try{
    if(saveError)throw saveError;
    if(name==='sapo'&&pauseUntil>now()){stage(name,'Đang chờ giới hạn Sapo…');await wait(pauseUntil-now());}
    stage(name,'Đang đối chiếu');p.stage='Đọc đối chiếu trước ghi';
    const paired=update.localOnly?await pair(item):null;
    if(p.status==='skipped_sapo_zero_price')continue;
    let fresh,desired;
    if(name==='kiot'){fresh=paired?.kiot||await service.readProduct(item.id);service.checkKiotSnapshot(state,item,fresh);desired=item.desiredNote;
     if(update.kiotDescription===false&&fresh.currentPrice===item.row.price){service.skipCorrectKiot(state,item,fresh);stages[name].processed++;continue;}
    }
    else{service.sapo.requireVerified();fresh=paired?.sapo||await readSapo(item.sapo);const before=expected.get(item.sapo.productId)||item.sapo.before;if(!before&&!update.localOnly)throw Error('Thiếu bản đối chiếu Sapo');if(before&&sapoFingerprint(fresh)!==sapoFingerprint(before))throw Error('Sapo thay đổi trước khi gửi');desired=service.sapoDescription===false?null:sapoNote(fresh.content,item.row,item.desiredNote);}
    if(!queued.has(item)){
     queued.clear();
     for(const next of update.items.slice(update.items.indexOf(item))){
      if(queued.size>=JOURNAL_WINDOW)break;
      const r=next.platforms[name];if(r.status==='ready'){r.status='sending';r.stage=update.kiotDescription===false&&name==='kiot'?'Gửi giá':'Gửi giá và mô tả';r.requestSent=true;queued.add(next);}
     }
     state.tableStale=true;stage(name,'Đang lưu nhật ký');await save();
    }
    p.status='sending';p.stage=update.kiotDescription===false&&name==='kiot'?'Gửi giá':'Gửi giá và mô tả';p.requestSent=true;
    // The Sapo snapshot is first obtained here in background runs; persist it before PUT.
    if(update.localOnly&&name==='sapo')await save();
    if(saveError)throw saveError;stage(name,'Đang gửi');sending=true;
    if(name==='kiot')await service.sendUpdate(fresh,{basePrice:item.row.price,...(update.kiotDescription!==false?{description:desired}:{})});
    else await service.timed('SAPO PUT',()=>service.sapo.client.update(item.sapo.productId,item.sapo.variantId,item.row.price,desired));
    p.stage='Xác minh sau ghi';stage(name,'Đang xác minh');
    const actual=name==='kiot'?await service.readProduct(item.id):await readSapo(item.sapo);
    if(name==='kiot'){
     if(actual.id!==item.id||actual.currentPrice!==item.row.price||actual.notes!==desired)throw Error('Kiot: giá/mô tả đọc lại không khớp');
     service.syncKiotProduct(state,actual,item.id);
    }else{
     if(actual.variants.find(v=>v.id===item.sapo.variantId)?.price!==item.row.price||actual.content!==(desired??fresh.content))throw Error('Sapo: giá/mô tả đọc lại không khớp');
     expected.set(item.sapo.productId,actual);
    }
    p.afterProduct=structuredClone(actual);p.status='done';p.verifiedAt=service.clock().toISOString();stages[name].processed++;
   }catch(e){
    const rejected=['Gửi giá','Gửi giá và mô tả'].includes(p.stage)&&e.httpStatus>=400&&e.httpStatus<500&&e.httpStatus!==408&&e.uncertain!==true;
    p.status=sending&&!rejected?'unknown':update.localOnly&&!sending&&p.stage==='Đọc đối chiếu trước ghi'?'preflight_failed':'write_failed';p.error=e.message;p.failureStage=p.stage;
    if(name==='sapo'&&e.httpStatus===429){pauseUntil=now()+(Number(e.retryAfter)>0?Number(e.retryAfter)*1000:2000);if(rejected)p.error='Sapo quá giới hạn — chưa ghi';}
    // Pre-marked in a window but stopped before its request: nothing was sent for this product.
    if(!sending&&!saveError)p.requestSent=false;
    if(update.continueOnError&&!saveError&&!stopsPlatform(e))continue;
    // After an uncertain write no extra GET, retry PUT or compensation write.
    for(const rest of update.items.slice(update.items.indexOf(item)+1)){const r=rest.platforms[name];r.status='not_sent';r.error='Không cập nhật — bên này đã dừng';}
    if(!saveError)await save();break;
   }finally{await arrived(item,name);}
  }
  }finally{active.delete(name);releaseBarriers();}
 }
 await Promise.allSettled(names.map(worker));await tail;
 if(saveError)throw saveError;
 summarize(update);update.outcome=update.items.every(i=>['done','unchanged','skipped_sapo_zero_price'].includes(i.status))?'success':'partial_failure';await save();
}
