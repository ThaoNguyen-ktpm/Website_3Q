export function updateSummary(items = []) {
  const succeeded = items.filter(p => p.status === 'done').length;
  return { total: items.length, succeeded, failed: items.length - succeeded };
}
export function failureReason(item) {
  if (item.status === 'done') return '';
  return item.error || ({conflict:'Dữ liệu thay đổi; cần tính lại và xác nhận mới',
    price_pending:'Chưa xác minh được giá bán dự kiến trên Kiot',
    note_pending:'Chưa xác minh được ghi chú hoặc dữ liệu sau ghi',
    journaled:'Lượt bị gián đoạn hoặc chưa xử lý; cần đối chiếu Kiot',
    unknown:'Mất phản hồi; chưa xác minh trạng thái Kiot'})[item.status] || 'Chưa hoàn tất — cần đối chiếu';
}
export const reportItems = items => items.map(p => ({id:p.id,code:p.code,name:p.name,
  beforePrice:p.before?.currentPrice,price:p.row?.price,status:p.status,error:failureReason(p),verifiedAt:p.verifiedAt||null,
  stage:p.stage,failureStage:p.failureStage,rollbackResult:p.rollbackResult,requestSent:p.requestSent,diagnostic:p.diagnostic,verificationDiagnostic:p.verificationDiagnostic,...(p.platforms?{platforms:Object.fromEntries(Object.entries(p.platforms).map(([name,{afterProduct,...result}])=>[name,result]))}:{})}));
const baseSummaryText = (s,update) => {
  // Bảo 2026-10-19 (TASK-037): an update reports only how many products succeeded; errors are listed in Lịch sử.
  if(update?.mode==='joint-v1'&&update.outcome!=='interrupted'){
    const items=update.items||[],done=items.filter(i=>i.status==='done').length;
    if(!items.length&&update.unchanged)return `Tất cả ${update.unchanged} sản phẩm đã đúng giá, không cần cập nhật.`;
    return `Đã cập nhật thành công ${done}/${items.length} sản phẩm.`+(done<items.length?` Lỗi ${items.length-done} sản phẩm.`:'')+(update.unchanged?` Bỏ qua ${update.unchanged} sản phẩm đã đúng giá.`:'');
  }
  if(['joint-v1','restore-joint-v1'].includes(update?.mode))return (update.mode==='restore-joint-v1'?'Khôi phục — ':'')+(update.platformSummary?Object.keys(update.platformSummary):['kiot','sapo']).map(name=>{const p=update.platformSummary?.[name]||updateSummary((update.items||[]).map(i=>i.platforms?.[name]||{}));const errors=[...new Set((update.items||[]).map(i=>i.platforms?.[name]?.error).filter(Boolean))];return `${name==='kiot'?'Kiot':'Sapo'}: thành công ${p.succeeded} sản phẩm${p.failed?`, lỗi/chưa xác định ${p.failed}${errors.length?' — '+errors.join('; '):''}`:''}`;}).join('. ')+'.';
  if(update?.outcome==='success')return `Đã cập nhật thành công ${s.total} sản phẩm.`;
  if(update?.outcome==='rolled_back')return 'Lượt cập nhật thất bại; đã khôi phục các thay đổi về giá và ghi chú cũ.';
  if(update?.outcome==='preflight_failed')return 'Lượt cập nhật thất bại ở bước kiểm tra; chưa gửi thay đổi nào lên Kiot.';
  if(update?.outcome==='interrupted'&&update.mode==='stop-v1')return `Lượt cập nhật bị gián đoạn; có ${update.items.filter(p=>p.status==='unknown').length} sản phẩm chưa xác minh.`;
  if(['rollback_failed','interrupted'].includes(update?.outcome))return `Lượt cập nhật thất bại; có ${update.items.filter(p=>['rollback_failed','unknown'].includes(p.status)).length} sản phẩm chưa xác minh hoặc chưa hoàn tác được.`;
  return `Cập nhật thành công ${s.succeeded} sản phẩm; lỗi/chưa hoàn tất ${s.failed} sản phẩm.`;
};
export const issueCount=update=>new Set([...(update.items||[]).filter(p=>p.status!=='done'),...(update.skipped||[])].map(p=>p.code)).size;
export const summaryText=(s,update)=>baseSummaryText(s,update)+((update?.skipped||[]).length?` Không gửi cập nhật ${update.skipped.length} sản phẩm; xem danh sách lỗi trong Lịch sử.`:'');
