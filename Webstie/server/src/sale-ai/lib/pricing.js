import { validateManual } from './manual-pricing.js';
// Bảo 2026-10-19 (TASK-039): start date moved from 13/10 to 01/10/2026; 15-day steps unchanged.
export const POLICY = 'baoq-2026-10-30-hide-before-jul-v10';
export const START = '2026-10-01';
export const NO_MARKDOWN_BEFORE = '2026-07-01';
export const BATCH_FROM = '2026-07-01';
export const BATCH_TO = '2026-10-15';
export const BATCH_M1 = '2026-11-01';
export const STEP_DAYS = 15;
export const HOT_M0_DAYS = 45;
export function typeFromName(name) {
  if (typeof name !== 'string' || !name.trim()) return null;
  return name.includes('!') ? 'hottrend' : 'normal';
}
const bands = [
  [2, 0, 0, 0], [5, .2, .2, .2],
  [10, .3, .3, .5], [20, .5, .5, .7], [50, .8, .8, 1],
  [100, 1.5, 1.5, 1.5], [150, 2.5, 2.5, 2.5], [200, 3, 3, 3],
  [250, 4, 4, 4], [300, 5, 5, 5], [400, 7, 7, 7],
  [500, 8, 8, 8], [600, 10, 10, 10]
];
export const money = n => n == null ? '—' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(n) + 'đ';
export function vietnamTime(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}
export function validDay(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day;
}
export function creationDay(value) {
  if (typeof value !== 'string') return null;
  if (!validDay(value.slice(0, 10))) return null;
  // Kiot local date-time without offset is treated as Vietnamese wall time.
  if (/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?)?$/.test(value)) {
    const day = value.slice(0, 10);
    const clock = value.slice(11);
    if (clock && (!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,7})?)?$/.test(clock))) return null;
    return validDay(day) ? day : null;
  }
  if (!/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) return null;
  return vietnamTime(new Date(value)).date;
}
function baseAllowance(p0, price) {
  if (p0 < 10e6) return 800000;
  if (p0 < 20e6) return 1000000;
  if (p0 < 100e6) return price * .05;
  if (p0 < 150e6) return 6e6;
  if (p0 < 200e6) return 7e6;
  if (p0 < 300e6) return 8e6;
  if (p0 < 400e6) return 10e6;
  return 15e6;
}
export function calculate(product, day) {
  if (!validDay(day)) throw new Error('Ngày xét không hợp lệ');
  const type = typeFromName(product.name);
  const result = { code: product.code, name: product.name, source: product.source,
    p0: product.p0, currentPrice: product.currentPrice, type, createdAt: product.createdAt,
    stock: product.stock, m: null, price: null, allowance: null, net: null, reasons: [], status: 'waiting' };
  Object.assign(result, ageFields(product, day));
  result.startDate = result.saleStartDate;
  result.age = result.ageDays;
  if (product.inventoryMissing || product.activeMissing) return { ...result, reasons: ['Thiếu trạng thái kinh doanh hoặc tồn kho chi nhánh'] };
  if (!product.active || !(product.stock > 0)) return { ...result, status: 'excluded', reasons: ['Bỏ qua: hết tồn hoặc ngừng kinh doanh'] };
  if (!Number.isSafeInteger(product.p0) || product.p0 <= 0) result.reasons.push('Giá gốc P0 không hợp lệ');
  const created = creationDay(product.createdAt);
  if (!created) result.reasons.push('Thiếu hoặc sai thời gian tạo Kiot');
  if (!type) result.reasons.push('Thiếu hoặc rỗng tên sản phẩm: chờ xử lý');
  if (created && created > day) result.reasons.push('Thời gian tạo nằm trong tương lai');
  if (day < START) result.reasons.push('Ngày xét trước mốc 01/10/2026');
  if (result.reasons.length) return result;
  if (created < NO_MARKDOWN_BEFORE) return { ...result, status: 'excluded', excludedReason: 'before_no_markdown', reasons: ['Hàng tạo trước 01/07/2026: không giảm'] };
  if (product.p0 >= 600e6) {
    if (!product.manualPricing || product.manualPricing.price == null || product.manualPricing.allowance == null) {
      return { ...result, reasons: ['Chờ nhập giá duyệt riêng'] };
    }
    try { validateManual(product.manualPricing.price, product.manualPricing.allowance); }
    catch (error) { return { ...result, reasons: [error.message] }; }
    result.pricingMode = 'manual';
    result.manualPricing = structuredClone(product.manualPricing);
    result.price = product.manualPricing.price;
    result.allowance = product.manualPricing.allowance;
  } else {
  const band = bands.find(b => product.p0 < b[0] * 1e6);
  result.markdown = result.m === 0 ? 0 : (band[1] + (result.m >= 2 ? band[2] : 0) + Math.max(0, result.m - 2) * band[3]) * 1e6;
  result.markdown = Math.round(result.markdown); // table amounts are exact integer VND
  result.price = product.p0 - result.markdown;
  result.allowance = product.p0 < 5e6 || result.m >= 4 ? 0 : result.m === 3 ?
    (product.p0 < 100e6 ? result.price * .03 : baseAllowance(product.p0, result.price) / 2) : baseAllowance(product.p0, result.price);
  }
  result.net = result.price - result.allowance;
  if (result.price <= 0 || result.net <= 0) result.reasons.push('Giá sau giảm hoặc giá chốt không dương: cần xem xét');
  if (!Number.isInteger(result.allowance)) result.reasons.push('Quyền sale có phần lẻ VND: chờ quy tắc làm tròn');
  result.status = result.reasons.length ? 'waiting' : 'simulated';
  result.notePreview = previewNote(product.notes || '', result, day);
  return result;
}
export function ageFields(product, day) {
  const createdDateVN = creationDay(product.createdAt);
  const excluded = createdDateVN !== null && createdDateVN < NO_MARKDOWN_BEFORE;
  const batch = createdDateVN !== null && createdDateVN >= BATCH_FROM && createdDateVN <= BATCH_TO;
  const saleStartDate = !createdDateVN || excluded ? null : batch ? BATCH_M1 : createdDateVN;
  const valid = validDay(day) && createdDateVN && day >= createdDateVN && day >= START;
  // The batch has not aged before its shared November start, but is already M0.
  const ageDays = valid && saleStartDate ? Math.max(0, (Date.parse(day) - Date.parse(saleStartDate)) / 86400000) : null;
  const type = typeFromName(product.name);
  return { createdDateVN, saleStartDate, ageAsOfDate: day, ageDays,
    m: ageDays !== null && type ? (batch ? (day < BATCH_M1 ? 0 : Math.min(6, 1 + Math.floor(ageDays / STEP_DAYS))) :
      Math.min(6, Math.floor(Math.max(0, ageDays - (type === 'hottrend' ? HOT_M0_DAYS - STEP_DAYS : 0)) / STEP_DAYS))) : null,
    dateStatus: !createdDateVN ? 'invalid' : !valid ? 'future_or_before_start' : 'valid' };
}
export function previewNote(existing, result, day) {
  const event = result.pricingMode === 'manual' ? 'Dùng giá tay duyệt riêng; giữ giá và quyền sale đến khi sửa lại, không áp dụng markdown tự động.' : result.m === 0 ? 'M0 — chưa markdown' : `Áp dụng M1–M${result.m} từ P0 ${money(result.p0)}`;
  const block = `[BAOQ-MO-PHONG]\nNgày xét: ${day} | M${result.m} | Giá dự kiến: ${money(result.price)}\nQuyền sale hiện tại dự kiến: ${money(result.allowance)}\nSự kiện dự kiến: ${event}\nChỉ mô phỏng — chưa cập nhật Kiot.\n[/BAOQ-MO-PHONG]`;
  // Replace only a complete owned preview block; preserve all other text.
  const owned = '\\[BAOQ-MO-PHONG\\][\\s\\S]*?\\[\\/BAOQ-MO-PHONG\\]';
  // Remove the owned block and only its generated blank-line separator.
  // Preserve original HTML and trailing whitespace verbatim.
  const marker = new RegExp(`(?:\\r?\\n){2}${owned}|${owned}(?:(?:\\r?\\n){2})?`, 'g');
  const rest = existing.replace(marker, '');
  return rest ? `${block}\n\n${rest}` : block;
}
