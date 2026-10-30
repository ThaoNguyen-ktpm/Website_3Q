import {randomUUID} from 'node:crypto';
import {sapoFingerprint} from './sapo.js';
import {updateSummary} from './update-report.js';
const equalKiot=(a,b)=>a.id===b.id&&a.code===b.code&&a.currentPrice===b.currentPrice&&a.notes===b.notes;
const clone=value=>structuredClone(value);
const hasSapo=update=>update.items.some(i=>i.platforms?.sapo);
function sourceFor(service,state,id){
 const source=state.updates?.find(u=>u.id===id);
 if(!source||source.mode!=='joint-v1'||source.restoreVersion!==1)throw Error('Lượt này chưa có bản khôi phục được kiểm chứng; chỉ hỗ trợ lượt cập nhật mới.');
 // Kiot-only updates have no Sapo platform, so restoring them never touches Sapo.
 if(hasSapo(source)){
  if(source.sapoBinding!==service.sapo?.binding)throw Error('Cấu hình Sapo đã đổi; không thể khôi phục sang cấu hình khác.');
  service.sapo.requireVerified();
 }
 // Bảo 2026-10-20: only a running update blocks restore; its unknown or failed products are skipped (no verified write to undo).
 if(source.attempts?.some(a=>a.status==='running'))throw Error('Lượt cập nhật còn đang chạy; chờ xong rồi khôi phục.');
 if(state.updates.some(u=>u.mode==='restore-joint-v1'&&u.sourceId===id&&u.items.some(i=>Object.values(i.platforms||{}).some(p=>p.requestSent))))throw Error('Lượt này đã có yêu cầu khôi phục; xem kết quả trong Lịch sử, không gửi lại.');
 return source;
}
async function read(service,task){return task.name==='kiot'?service.readProduct(task.productId):service.sapo.client.product(task.productId);}
function same(task,actual){return task.name==='kiot'?equalKiot(actual,task.expected):sapoFingerprint(actual)===sapoFingerprint(task.expected);}
/** Tasks whose product changed after the update (or cannot be read), widened to every task of the same products:
 * an edited product is left as it is on both sides, the others still restore (Bảo 2026-10-20). */
async function blockedTasks(service,tasks,message){
 const blocked=new Map(),codes=new Set();
 for(const task of tasks){
  try{if(!same(task,await read(service,task)))throw Error(message);}
  catch(e){if(e.httpStatus===401||e.httpStatus===403)throw e;blocked.set(task,e.message);task.codes.forEach(code=>codes.add(code));}
 }
 for(let grew=true;grew;){grew=false;for(const task of tasks)if(!blocked.has(task)&&task.codes.some(code=>codes.has(code))){blocked.set(task,'Cùng sản phẩm với món đã thay đổi');task.codes.forEach(code=>codes.add(code));grew=true;}}
 return {blocked,codes};
}
function tasksFor(source){
 const tasks=[],groups=new Map();
 for(const item of source.items){
  // TASK-102: a side already right before the update (alreadyOk) was never written, so there is nothing to restore.
  if(item.platforms.kiot.status==='done'&&!item.platforms.kiot.alreadyOk){
   const expected=item.platforms.kiot.afterProduct;if(!expected)throw Error('Thiếu bản đọc lại Kiot; không khôi phục.');
   tasks.push({name:'kiot',productId:item.id,codes:[item.code],expected:clone(expected),target:clone(item.before)});
  }
  if(item.platforms.sapo?.status==='done'&&!item.platforms.sapo.alreadyOk){
   const expected=item.platforms.sapo.afterProduct;if(!expected)throw Error('Thiếu bản đọc lại Sapo; không khôi phục.');
   let group=groups.get(item.sapo.productId);
   if(!group){group={name:'sapo',productId:item.sapo.productId,codes:[],expected:null,target:clone(item.sapo.before),variants:[]};groups.set(group.productId,group);}
   const before=group.target.variants.find(v=>v.id===item.sapo.variantId);if(!before||before.sku!==(item.sapo.code??item.code))throw Error('Bản gốc Sapo không khớp SKU.');
   group.codes.push(item.code);group.variants.push({id:before.id,price:before.price});group.expected=clone(expected);
  }
 }
 tasks.push(...groups.values());if(!tasks.length)throw Error('Không có thay đổi đã kiểm chứng để khôi phục.');return tasks;
}
export async function prepareRestore(service,sourceId){
 const origin=service.sim.state.updates?.find(u=>u.id===sourceId);const codes=origin?.items.map(i=>i.code)||[];
 return service.transaction('restore-prepare',codes,async state=>{
  const source=sourceFor(service,state,sourceId),all=tasksFor(source);
  const {blocked,codes}=await blockedTasks(service,all,'Đã thay đổi sau cập nhật; không ghi đè');
  const tasks=all.filter(task=>!blocked.has(task));
  if(!tasks.length)throw Error(`${[...codes].join(', ')}: đã thay đổi sau cập nhật; không có món nào khôi phục được, không ghi đè.`);
  const restores=(name,code)=>tasks.some(task=>task.name===name&&task.codes.includes(code));
  const skipped=source.items.filter(i=>codes.has(i.code)).map(i=>({id:i.id,code:i.code,name:i.name,status:'skipped',error:[...blocked].find(([task])=>task.codes.includes(i.code))?.[1]||'Đã thay đổi sau cập nhật'}));
  const items=source.items.map(i=>({code:i.code,name:i.name,id:i.id,
   before:clone(i.platforms.kiot.afterProduct||i.before),row:{price:i.before.currentPrice},notePreview:i.before.notes,
   ...(i.platforms.sapo?{sapo:{...clone(i.sapo),before:clone(tasks.find(t=>t.name==='sapo'&&t.codes.includes(i.code))?.expected||i.sapo.before),notePreview:i.sapo.before.content},
   restoreSapoPrice:i.sapo.before.variants.find(v=>v.id===i.sapo.variantId)?.price}:{}),
   restoreKiot:restores('kiot',i.code),restoreSapo:restores('sapo',i.code)}));
  const prepared={id:randomUUID(),kind:'restore',sourceId,at:service.clock().toISOString(),status:'prepared',sapoBinding:source.sapoBinding,tasks,items,skipped};
  state.prepared=[prepared];return prepared;
 });
}
function summarize(update){
 for(const i of update.items){i.status=Object.values(i.platforms).every(p=>p.status==='done'||p.skipped)?'done':Object.values(i.platforms).some(p=>p.status==='unknown')?'unknown':'write_failed';i.error=Object.values(i.platforms).map(p=>p.error).filter(Boolean).join('; ');}
 update.platformSummary=Object.fromEntries(Object.keys(update.items[0]?.platforms||{kiot:{}}).map(name=>[name,updateSummary(update.items.map(i=>i.platforms[name]).filter(p=>p&&!p.skipped))]));
}
export async function commitRestore(service,id,confirmed){
 if(confirmed!==true)throw Error('Chưa xác nhận khôi phục Kiot + Sapo.');
 const codes=service.sim.state.prepared?.find(p=>p.id===id)?.items.map(i=>i.code)||[];
 return service.transaction('restore-commit',codes,async(state,scope)=>{
  const p=state.prepared?.find(p=>p.id===id);
  if(!p||p.kind!=='restore'||p.status!=='prepared'||service.clock().getTime()-Date.parse(p.at)>300000)throw Error('Bản xác nhận khôi phục hết hạn hoặc không hợp lệ.');
  sourceFor(service,state,p.sourceId);p.status='consumed';
  const update={id:randomUUID(),mode:'restore-joint-v1',sourceId:p.sourceId,at:service.clock().toISOString(),label:p.items.some(i=>i.sapo)?'Khôi phục Kiot + Sapo':'Khôi phục Kiot',items:p.items.map(i=>({...clone(i),status:'journaled',platforms:{kiot:{status:i.restoreKiot?'journaled':'done',skipped:!i.restoreKiot},...(i.sapo?{sapo:{status:i.restoreSapo?'journaled':'done',skipped:!i.restoreSapo}}:{})}})),restoreTasks:clone(p.tasks),attempts:[{id:randomUUID(),at:service.clock().toISOString(),kind:'restore',status:'running'}],skipped:clone(p.skipped||[])};
  for(const item of update.items)for(const result of Object.values(item.platforms))if(result.skipped)result.status='skipped';
  scope.updateId=update.id;state.updates.unshift(update);
  let saveError;const save=async()=>{if(saveError)throw saveError;summarize(update);try{await service.checkpoint(state,update);}catch(e){saveError=e;throw e;}};await save();
  const results=task=>update.items.filter(i=>task.codes.includes(i.code)).map(i=>i.platforms[task.name]);
  const {blocked}=await blockedTasks(service,update.restoreTasks,'Dữ liệu thay đổi sau xác nhận khôi phục');
  for(const [task,error] of blocked)for(const r of results(task)){r.status='preflight_failed';r.error=error;}
  if(blocked.size===update.restoreTasks.length){for(const i of update.items)for(const r of Object.values(i.platforms))if(r.status==='journaled'){r.status='not_sent';r.error='Không gửi — kiểm tra khôi phục thất bại';}summarize(update);update.outcome='preflight_failed';await service.finishAttempt(state,update);return update;}
  for(const name of ['kiot','sapo']){
   let stopped=false;
   for(const task of update.restoreTasks.filter(t=>t.name===name&&!blocked.has(t))){
    const rs=results(task);if(stopped){for(const r of rs){r.status='not_sent';r.error='Bên này đã dừng khôi phục';}continue;}
    let sending=false,verifying=false;
    try{
     const actual=await read(service,task);
     // Edited in the last moment: leave this product, keep restoring the others.
     if(!same(task,actual)){for(const r of rs){r.status='preflight_failed';r.error='Dữ liệu thay đổi ngay trước khôi phục';}await save();continue;}
     for(const r of rs){r.status='sending';r.stage='Khôi phục giá và mô tả';r.requestSent=true;}state.tableStale=true;await save();sending=true;
     if(name==='kiot')await service.sendUpdate(actual,{basePrice:task.target.currentPrice,description:task.target.notes});
     else await service.sapo.client.restore(task.productId,task.variants,task.target.content);
     verifying=true;for(const r of rs)r.stage='Xác minh sau khôi phục';const restored=await read(service,task);
     if(name==='kiot'){if(!equalKiot(restored,task.target))throw Error('Kiot đọc lại không khớp bản gốc');const local=state.products.find(i=>i.id===task.productId);if(local)Object.assign(local,restored);}
     else if(sapoFingerprint(restored)!==sapoFingerprint(task.target))throw Error('Sapo đọc lại không khớp bản gốc');
     for(const r of rs){r.status='done';r.verifiedAt=service.clock().toISOString();}await save();
    }catch(e){if(saveError)throw saveError;const rejected=!verifying&&e.httpStatus>=400&&e.httpStatus<500&&e.httpStatus!==408&&e.uncertain!==true;for(const r of rs){r.status=sending&&!rejected?'unknown':'write_failed';r.error=e.message;}stopped=true;await save();}
   }
  }
  summarize(update);update.outcome=update.items.every(i=>i.status==='done')?'success':'partial_failure';await service.finishAttempt(state,update);return update;
 });
}
