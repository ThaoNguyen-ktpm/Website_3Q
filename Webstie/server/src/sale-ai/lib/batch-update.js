import { calculate, POLICY, vietnamTime } from './pricing.js';
import { fingerprint, liveNote } from './live.js';
import { createHash } from 'node:crypto';

// Stop on first failure. No compensation writes or automatic retries.
export async function executeBatch(service, state, update) {
  const save = () => service.checkpoint(state,update);
  const sync = (fresh,id) => {if(fresh.id!==id)throw Error('Kiot trả sai ID sản phẩm khi xác minh');const local=state.products.find(p=>p.id===id);if(local)Object.assign(local,fresh);};
  const sent=[];
  let failed=false;
  for (const item of update.items) {
    item.requestSent=false;
    item.stage='Kiểm tra trước khi ghi';
    try {
      const local=state.products.find(p=>p.id===item.id);
      const row=calculate(local,vietnamTime(service.clock()).date);
      const localKey=createHash('sha256').update(JSON.stringify([local.p0,local.manualPricing])).digest('hex');
      if(state.policy!==POLICY||localKey!==item.row.localKey||row.status!=='simulated'||row.price!==item.row.price||row.allowance!==item.row.allowance)throw Error('Điều kiện hoặc mốc M thay đổi');
      service.stage('Đang đối chiếu');
      const fresh=await service.readProduct(item.id);
      if(fingerprint(fresh)!==item.row.liveBase)throw Error('Dữ liệu Kiot đã thay đổi sau xác nhận');
      item.before=structuredClone(fresh);
      const vn=vietnamTime(service.clock());item.actualAt=`${vn.date} ${vn.time} (giờ Việt Nam)`;
      item.desiredNote=liveNote(fresh.notes,item.row,item.key,item.actualAt);
      item.status='ready';
    } catch(error) {item.status='preflight_failed';item.error=error.message;item.diagnostic=error.diagnostic;failed=true;}
  }
  if(failed) {
    update.outcome='preflight_failed';
    for(const item of update.items)if(item.status==='ready'){item.status='not_sent';item.error='Không cập nhật — lượt đã dừng';}
    await save();return;
  }
  await save();
  let activeItem;
  try {
    for(const item of update.items) {
      activeItem=item;
      item.stage='Đọc đối chiếu trước ghi';
      // Recheck immediately before sending, after other products may have changed.
      service.stage('Đang đối chiếu');
      const fresh=await service.readProduct(item.id);
      if(fingerprint(fresh)!==fingerprint(item.before)){item.status='conflict';throw Error('Dữ liệu thay đổi trước khi gửi');}
      if(fresh.currentPrice===item.row.price&&fresh.notes===item.desiredNote) {
        item.status='verified';item.verifiedAt=service.clock().toISOString();sync(fresh,item.id);await save();continue;
      }
      item.stage='Gửi giá và ghi chú';item.status='sending';item.requestSent=true;state.tableStale=true;await save();sent.push(item);
      service.stage('Đang gửi');
      await service.sendUpdate(fresh,{basePrice:item.row.price,description:item.desiredNote});
      item.stage='Xác minh sau ghi';
      service.stage('Đang xác minh');
      const actual=await service.readProduct(item.id);
      if(actual.currentPrice!==item.row.price||actual.notes!==item.desiredNote)throw Error('Giá hoặc ghi chú đọc lại không khớp');
      item.status='verified';item.verifiedAt=service.clock().toISOString();sync(actual,item.id);await save();
    }
    for(const item of update.items) {
      activeItem=item;item.stage='Xác minh toàn lượt';
      service.stage('Đang xác minh');
      const actual=await service.readProduct(item.id);
      if(actual.currentPrice!==item.row.price||actual.notes!==item.desiredNote)throw Error('Dữ liệu thay đổi khi xác minh toàn lượt');
      sync(actual,item.id);
      service.stage('Đang xác minh',(service.operation?.processed||0)+1);
    }
    for(const item of update.items)item.status='done';
    update.outcome='success';await save();return;
  } catch(error) {
    failed=true;
    const item=activeItem;
    if(item){item.error=error.message;item.diagnostic=error.diagnostic;if(!sent.includes(item)){item.status='write_failed';item.requestSent=false;}}
  }
  if(activeItem && sent.includes(activeItem)) {
    activeItem.failureStage=activeItem.stage;
    try {
      service.stage('Đang xác minh');
      const actual=await service.readProduct(activeItem.id);sync(actual,activeItem.id);
      activeItem.observedPrice=actual.currentPrice;activeItem.observedNotes=actual.notes;
      if(actual.currentPrice===activeItem.row.price&&actual.notes===activeItem.desiredNote) {
        activeItem.transportError=activeItem.error;activeItem.error=null;activeItem.status='done';activeItem.verifiedAt=service.clock().toISOString();
      } else activeItem.status='write_failed';
    }catch(error){activeItem.status='unknown';activeItem.verificationError=error.message;activeItem.verificationDiagnostic=error.diagnostic;}
  }
  for(const item of update.items) {
    if(item.status==='verified')item.status='done';
    if(item.status==='ready'){item.status='not_sent';item.error='Không cập nhật — lượt đã dừng';}
  }
  update.outcome=update.items.every(p=>p.status==='done')?'success':'partial_failure';
  await save();
}
