export const approvalLabel=approval=>({below_cost:'Duyệt dưới giá vốn',restore_cost:'Trả về giá vốn'})[approval?.kind]||'';
export function updateSummary(items = []) {
  const succeeded = items.filter(p => p.status === 'done').length;
  return { total: items.length, succeeded, failed: items.filter(p=>!['done','unchanged','skipped_sapo_zero_price','skipped_manual_price'].includes(p.status)).length };
}
// Display classification only; never change the journal's write/restore statuses.
export function reportStatus(item) {
  if(item.status==='skipped_manual_price')return item.status;
  if(item.status==='skipped_sapo_zero_price')return item.status;
  if (item.status==='unchanged') return 'unchanged';
  const platforms=Object.values(item.platforms||{}),states=platforms.map(p=>p.status);
  if(platforms.length&&platforms.every(p=>p.skipped&&!p.alreadyOk))return 'not_sent';
  if (item.status==='done') return 'done';
  if (['unknown','sending','verified','journaled','price_pending','note_pending','rolling_back','rollback_failed'].includes(item.status)||states.some(s=>['unknown','sending','journaled','rolling_back','rollback_failed'].includes(s))) return 'unknown';
  if (item.status==='preflight_failed'||item.status==='conflict'||states.includes('preflight_failed')) return 'preflight_failed';
  if (states.some(s=>['write_failed','rolled_back'].includes(s))) return 'write_failed';
  if (['skipped','not_sent','ready'].includes(item.status)||(states.length&&states.some(s=>s==='not_sent')&&states.every(s=>['not_sent','done','skipped'].includes(s)))) return 'not_sent';
  if (item.status==='write_failed'||item.status==='rolled_back') return 'write_failed';
  return 'unknown';
}
export function reportRows(update={}) {
  const rows=[],seen=new Set();
  const add=p=>{const key=p.code??p.id;if(key!=null&&seen.has(key))return;if(key!=null)seen.add(key);rows.push({...p,reportStatus:reportStatus(p)});};
  const skipped=new Map((update.skipped||[]).map(p=>[p.code,p]));
  for(const p of update.items||[]){
    const platforms=Object.values(p.platforms||{});
    const allSkipped=platforms.length&&platforms.every(result=>result.skipped&&!result.alreadyOk);
    add(allSkipped?{...p,status:'skipped',error:skipped.get(p.code)?.error||p.error||'Không có thay đổi đã kiểm chứng để khôi phục'}:p);
  }
  for(const p of update.skipped||[])add({...p,status:p.status==='skipped_manual_price'?p.status:'skipped'});
  for(const p of update.manualPriceSkips||[])add(p);
  for(const p of update.unverifiedSkips||[])add(p);
  const unchanged=Array.isArray(update.unchanged)?update.unchanged:update.unchangedCodes||[];
  for(const p of unchanged)add(typeof p==='string'?{code:p,status:'unchanged'}:{...p,status:'unchanged'});
  return rows;
}
export function updateReport(update={}) {
  const rows=reportRows(update),count=status=>rows.filter(p=>p.reportStatus===status).length;
  // Old journals kept only a count; report it without fabricating product codes.
  const unnamedUnchanged=!Array.isArray(update.unchanged)&&!Array.isArray(update.unchangedCodes)&&Number.isSafeInteger(update.unchanged)&&update.unchanged>0?update.unchanged:0;
  const succeeded=count('done'),preflightFailed=count('preflight_failed'),writeFailed=count('write_failed'),unverified=count('unknown'),notSent=count('not_sent'),unchanged=count('unchanged')+unnamedUnchanged;
  const skippedSapoZeroPrice=count('skipped_sapo_zero_price');
  const failed=preflightFailed+writeFailed+unverified;
  return {total:rows.length+unnamedUnchanged,succeeded,failed,manualPriceSkipped:count('skipped_manual_price'),skippedSapoZeroPrice,preflightFailed,writeFailed,unverified,notSent,unchanged,issues:failed+notSent,unnamedUnchanged};
}
export function failureReason(item) {
  if (item.status === 'done'||item.status==='unchanged') return '';
  const platformErrors=Object.entries(item.platforms||{}).filter(([,p])=>p.status!=='done'&&p.error).map(([name,p])=>`${name==='kiot'?'Kiot':'Sapo'}: ${p.error}`).join('; ');
  return item.error || platformErrors || ({conflict:'Dữ liệu thay đổi; cần tính lại và xác nhận mới',
    price_pending:'Chưa xác minh được giá bán dự kiến trên Kiot',
    note_pending:'Chưa xác minh được ghi chú hoặc dữ liệu sau ghi',
    journaled:'Lượt bị gián đoạn hoặc chưa xử lý; cần đối chiếu Kiot',
    unknown:'Mất phản hồi; chưa xác minh trạng thái Kiot'})[item.status] || 'Chưa hoàn tất — cần đối chiếu';
}
export const reportItems = items => items.map(p => ({id:p.id,code:p.code,name:p.name,
  beforePrice:p.before?.currentPrice,price:p.row?.price,status:p.status,error:failureReason(p),verifiedAt:p.verifiedAt||null,
  stage:p.stage,failureStage:p.failureStage,rollbackResult:p.rollbackResult,requestSent:p.requestSent,diagnostic:p.diagnostic,verificationDiagnostic:p.verificationDiagnostic,...(p.platforms?{platforms:Object.fromEntries(Object.entries(p.platforms).map(([name,{afterProduct,...result}])=>[name,result]))}:{})}));
// Bảo 2026-10-19 (TASK-037): an update reports only how many products succeeded; errors are listed in Lịch sử.
// TASK-114 now displays every selected product and separates failure stages.
export const issueCount=update=>new Set([...(update.items||[]),...(update.skipped||[]),...(update.unverifiedSkips||[])].filter(p=>!['done','unchanged','skipped_sapo_zero_price','skipped_manual_price'].includes(p.status)).map(p=>p.code)).size;
export function summaryText(summary,update) {
  const s=summary?.preflightFailed!==undefined?summary:updateReport(update),n=value=>Number(value||0).toLocaleString('vi-VN');
  if(update?.message)return update.message;
  const parts=[`${n(s.succeeded)}/${n(s.total)} thành công`];
  if(s.skippedSapoZeroPrice){parts.push(`${n(s.failed)} lỗi`,`${n(s.skippedSapoZeroPrice)} bỏ qua (Sapo giá 0)`);return parts.join(' · ');}
  for(const [key,label] of [['preflightFailed','lỗi kiểm tra'],['writeFailed','lỗi khi ghi'],['unverified','chưa xác minh'],['notSent','chưa gửi'],['unchanged','đã đúng giá']])if(s[key])parts.push(`${n(s[key])} ${label}`);
  if(s.manualPriceSkipped)parts.push(`${n(s.manualPriceSkipped)} giữ giá sửa tay`);
  return (approvalLabel(update?.approval)?approvalLabel(update.approval)+' ? ':'')+(update?.mode==='restore-joint-v1'?'Khôi phục — ':'')+parts.join(' · ');
}
