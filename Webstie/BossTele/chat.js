'use strict';

const readline = require('node:readline');
const { createChatSession } = require('./lib/chat-session');
const { createProductSearch } = require('./lib/product-search');
const { loadConnectionConfig } = require('./lib/connection-config');
const { HELP } = require('./lib/chat-commands');

function safeText(value) {
  return String(value ?? 'chưa xác định').replace(/[\x00-\x1f\x7f-\x9f]/g, ' ').slice(0, 200);
}
function money(value) {
  if (value === null || value === undefined) return 'chưa xác định';
  return `${safeText(value)} VND`;
}
function render(response) {
  const lines = [];
  if (response.message) lines.push(response.message);
  for (const [index, row] of (response.rows || []).entries()) {
    lines.push(`${index + 1}. ${safeText(row.source)} | ${safeText(row.sku)} | ${safeText(row.name)} | giá ${money(row.price)} | tồn ${safeText(row.onHand)}`);
  }
  if (response.selected) {
    const row = response.selected;
    lines.push(`${safeText(row.source)} | SKU ${safeText(row.sku)} | ID ${safeText(row.productId)} | variant ${safeText(row.variantId)}`);
  }
  if (response.calculation) {
    const c = response.calculation;
    lines.push(`Vốn ${c.capital} VND; chi phí ${c.expenses} VND; C=${c.cost} VND; ${c.method} ${c.rate}%.`, `Công thức: ${c.formula}.`, `Giá bán mục tiêu: ${c.sellingPrice} VND (làm tròn lên đến đồng).`);
  }
  lines.push(...(response.messages || []).map(safeText));
  return lines.join('\n');
}

async function runChat({ input = process.stdin, output = process.stdout, session } = {}) {
  let backend;
  session ||= createChatSession({ search: async options => {
    backend ||= createProductSearch(loadConnectionConfig());
    return backend(options);
  } });
  output.write(`BossTele — tìm sản phẩm và tính giá bằng code. AI tắt.\n${HELP}\n`);
  const reader = readline.createInterface({ input, crlfDelay: Infinity, terminal: false });
  if (input.isTTY) output.write('BossTele> ');
  try {
    for await (const line of reader) {
      const response = await session.handle(line);
      output.write(`${render(response)}\n`);
      if (response.action === 'exit') break;
      if (input.isTTY) output.write('BossTele> ');
    }
  } finally { reader.close(); }
  return session.stats;
}

if (require.main === module) runChat().catch(() => { console.error('Không chạy được phiên BossTele. Không có khóa nào được in ra.'); process.exitCode = 1; });
module.exports = { runChat, render };
