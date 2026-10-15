'use strict';

const REJECT = 'BossTele chỉ hỗ trợ tra cứu sản phẩm và tính giá sản phẩm. Câu hỏi ngoài phạm vi này không được xử lý.';
const HELP = 'tìm tên "Chanel" nguồn=kiot | tìm sku SP022466 nguồn=sapo\nxem thêm | chọn 2\ntính giá vốn=150000000 chi_phí=0 cách=markup tỷ_lệ=12.5\nphân tích giá | trợ giúp | thoát\nnguồn: kiot, sapo, all (mặc định); cách: markup hoặc margin. AI đang tắt.';

function parseCommand(input) {
  if (typeof input !== 'string' || [...input].length > 500 || /[\x00-\x1f\x7f-\x9f]/.test(input)) return null;
  const line = input.trim().normalize('NFC');
  const simple = { 'xem thêm': 'more', 'phân tích giá': 'analyze', 'trợ giúp': 'help', 'thoát': 'exit' };
  if (Object.hasOwn(simple, line)) return { action: simple[line] };
  let match = /^tìm tên "([^"\r\n]{1,200})"(?: nguồn=(kiot|sapo|all))?$/.exec(line);
  if (match && match[1].trim()) return { action: 'search', kind: 'name', query: match[1].trim(), source: match[2] || 'all' };
  match = /^tìm sku ([A-Za-z0-9][A-Za-z0-9._\/-]{0,199})(?: nguồn=(kiot|sapo|all))?$/.exec(line);
  if (match) return { action: 'search', kind: 'sku', query: match[1], source: match[2] || 'all' };
  match = /^chọn ([1-9]|10)$/.exec(line);
  if (match) return { action: 'select', index: Number(match[1]) };
  match = /^tính giá vốn=(\d+) chi_phí=(\d+) cách=(markup|margin) tỷ_lệ=(\d+(?:\.\d+)?)$/.exec(line);
  if (match) {
    const parameters = { capital: match[1], expenses: match[2], method: match[3], rate: match[4] };
    if (BigInt(parameters.capital) === 0n) return null;
    const [whole] = parameters.rate.split('.');
    if (parameters.method === 'margin' && BigInt(whole) >= 100n) return null;
    return { action: 'calculate', parameters };
  }
  return null;
}

module.exports = { parseCommand, REJECT, HELP };
