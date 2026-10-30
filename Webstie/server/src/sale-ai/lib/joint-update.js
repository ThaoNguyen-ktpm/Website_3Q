import {createHash} from 'node:crypto';
import {calculate,POLICY,vietnamTime} from './pricing.js';
import {fingerprint,liveNote} from './live.js';
import {sapoFingerprint,sapoNote} from './sapo.js';
import {updateSummary} from './update-report.js';
import {stopsPlatform} from './update-errors.js';
import {readPool} from './read-pool.js';
export function summarize(update){
 for(const item of update.items){item.status=Object.values(item.platforms).every(p=>p.status==='done')?'done':Object.values(item.platforms).some(p=>p.status==='unknown')?'unknown':'write_failed';item.error=Object.entries(item.platforms).filter(([,p])=>p.status!=='done').map(([name,p])=>`${name==='kiot'?'Kiot':'Sapo'}: ${p.error||p.status}`).join('; ');}
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
   const [fresh,sp]=await Promise.all([service.readProduct(item.id),withSapo?readSapo(item.sapo):null]);
   if(fresh.id!==item.id||fingerprint(fresh)!==item.row.liveBase)throw Error('Kiot thay đổi sau xác nhận');
   if(withSapo&&sapoFingerprint(sp)!==item.sapo.fingerprint)throw Error('Sapo thay đổi sau xác nhận');
   item.before=fresh;const vn=vietnamTime(service.clock());item.actualAt=`${vn.date} ${vn.time} (giờ Việt Nam)`;item.desiredNote=liveNote(fresh.notes,item.row,item.key,item.actualAt);
   for(const p of Object.values(item.platforms))p.status='ready';
  }catch(e){failed ||= !update.continueOnError||stopsPlatform(e);for(const p of Object.values(item.platforms)){p.status='preflight_failed';p.error=e.message;}}
 });
 if(failed){for(const item of update.items)for(const p of Object.values(item.platforms))if(p.status==='ready'){p.status='not_sent';p.error=withSapo?'Không cập nhật — kiểm tra hai bên thất bại':'Không cập nhật — kiểm tra trước ghi thất bại';}update.outcome='preflight_failed';await save();return;}
 await save();
 async function worker(name){
  // Expected Sapo state tracks shared product descriptions between selected
  // variants; SKU-owned blocks preserve each variant's BAOQ section.
  const expected=new Map();
  // Bảo 2026-10-19 (TASK-037): the journal is saved once per window of products, not before and after every product.
  // The whole window is saved as "sending" first, so a crash shows those products unknown (never "not sent"); results
  // and errors of a window are saved with the next window or at the end.
  const queued=new Set();
  for(const item of update.items){
   const p=item.platforms[name];let sending=false;
   if(p.status!=='ready'&&!queued.has(item))continue;
   try{
    if(saveError)throw saveError;
    stage(name,'Đang đối chiếu');p.stage='Đọc đối chiếu trước ghi';
    let fresh,desired;
    if(name==='kiot'){fresh=await service.readProduct(item.id);if(fingerprint(fresh)!==fingerprint(item.before))throw Error('Kiot thay đổi trước khi gửi');desired=item.desiredNote;}
    else{service.sapo.requireVerified();fresh=await readSapo(item.sapo);const before=expected.get(item.sapo.productId)||item.sapo.before;if(sapoFingerprint(fresh)!==sapoFingerprint(before))throw Error('Sapo thay đổi trước khi gửi');desired=service.sapoDescription===false?null:sapoNote(fresh.content,item.row,item.desiredNote);}
    if(!queued.has(item)){
     queued.clear();
     for(const next of update.items.slice(update.items.indexOf(item))){
      if(queued.size>=JOURNAL_WINDOW)break;
      const r=next.platforms[name];if(r.status==='ready'){r.status='sending';r.stage='Gửi giá và mô tả';r.requestSent=true;queued.add(next);}
     }
     state.tableStale=true;stage(name,'Đang lưu nhật ký');await save();
    }
    p.status='sending';p.stage='Gửi giá và mô tả';p.requestSent=true;
    if(saveError)throw saveError;stage(name,'Đang gửi');sending=true;
    if(name==='kiot')await service.sendUpdate(fresh,{basePrice:item.row.price,description:desired});
    else await service.timed('SAPO PUT',()=>service.sapo.client.update(item.sapo.productId,item.sapo.variantId,item.row.price,desired));
    p.stage='Xác minh sau ghi';stage(name,'Đang xác minh');
    const actual=name==='kiot'?await service.readProduct(item.id):await readSapo(item.sapo);
    if(name==='kiot'){
     if(actual.id!==item.id||actual.currentPrice!==item.row.price||actual.notes!==desired)throw Error('Kiot: giá/mô tả đọc lại không khớp');
     Object.assign(state.products.find(x=>x.id===item.id),actual);
    }else{
     if(actual.variants.find(v=>v.id===item.sapo.variantId)?.price!==item.row.price||actual.content!==(desired??fresh.content))throw Error('Sapo: giá/mô tả đọc lại không khớp');
     expected.set(item.sapo.productId,actual);
    }
    p.afterProduct=structuredClone(actual);p.status='done';p.verifiedAt=service.clock().toISOString();stages[name].processed++;
   }catch(e){
    const rejected=p.stage==='Gửi giá và mô tả'&&e.httpStatus>=400&&e.httpStatus<500&&e.httpStatus!==408&&e.uncertain!==true;
    p.status=sending&&!rejected?'unknown':'write_failed';p.error=e.message;p.failureStage=p.stage;
    // Pre-marked in a window but stopped before its request: nothing was sent for this product.
    if(!sending&&!saveError)p.requestSent=false;
    if(update.continueOnError&&!saveError&&!stopsPlatform(e))continue;
    // After an uncertain write no extra GET, retry PUT or compensation write.
    for(const rest of update.items.slice(update.items.indexOf(item)+1)){const r=rest.platforms[name];r.status='not_sent';r.error='Không cập nhật — bên này đã dừng';}
    if(!saveError)await save();break;
   }
  }
 }
 await Promise.allSettled(names.map(worker));await tail;
 if(saveError)throw saveError;
 summarize(update);update.outcome=update.items.every(i=>i.status==='done')?'success':'partial_failure';await save();
}
