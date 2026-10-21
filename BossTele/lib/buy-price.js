'use strict';

// Bảo 2026-10-20: purchase-price hint for a product photo = reference price ÷ (1 + desired profit of its tier), from the example
// table of the PRICE-SYSTEM plan in price-tiers.json. Gợi ý, chưa phải chính sách: Bảo will settle the numbers and edits that file.
// Profit is on cost (markup); a tier is chosen by the cost it produces, so the result always lies in its own tier.
// Each Kiot category has its own table; a category without one gets no hint. Rare or high-value items need Bảo/Nguyên first.
const fs = require('node:fs');
const path = require('node:path');

const CONFIG_FILE = path.join(__dirname, '..', 'price-tiers.json');
const loadConfig = (file = CONFIG_FILE) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
const tr = value => `${(value / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 2 })}tr`;
const percent = rate => `${(Math.round(rate * 1000) / 10).toLocaleString('vi-VN')}%`;

/** Highest purchase price that keeps the tier's profit when sold at `sale`, rounded down to 100.000đ. */
function maxBuyPrice(sale, tiers) {
  let low = 0;
  for (const tier of tiers) {
    const cost = sale / (1 + tier.profit);
    if (cost >= low && (tier.under === null || cost < tier.under)) return { cost: Math.floor(cost / 1e5) * 1e5, profit: tier.profit };
    low = tier.under ?? low;
  }
  const last = tiers.at(-1);
  return { cost: Math.floor(sale / (1 + last.profit) / 1e5) * 1e5, profit: last.profit };
}

/** Rare or high-value (PRICE-SYSTEM case 3: Nguyên approves last): by price or a keyword of the name. */
function needsFounder(config, name, price) {
  const rule = config.founderReview;
  return !!rule && (price >= rule.atLeast || rule.keywords.some(keyword => fold(name).includes(fold(keyword))));
}

/**
 * Replaces Claude's "Giá thị trường (Kiot|web): low-high, giữa mid" line with the range and the purchase hint for the
 * category on the "Danh mục:" line, and checks Bảo's own purchase price when he gave one.
 */
function withBuyPrice(reply, paid = null, config = loadConfig(), staff = false) {
  const line = reply.match(/^Giá thị trường(?:\s*\([^)]*\))?:.*$/m)?.[0];
  const source = /^Giá thị trường\s*(\([^)]*\))/.exec(line ?? '')?.[1];
  const numbers = line?.match(/\d[\d.,]*/g)?.map(value => Number(value.replace(/[.,]/g, ''))).filter(value => value >= 1e6) ?? [];
  if (!line || !numbers.length) return reply;
  const middle = Number(/giữa\s*([\d.,]+)/i.exec(line)?.[1]?.replace(/[.,]/g, '')) || numbers.at(-1);
  const category = /^Danh mục:\s*(.+?)\s*$/m.exec(reply)?.[1] ?? '';
  const name = /^Tên:\s*(.+)$/m.exec(reply)?.[1] ?? '';
  const tiers = Object.entries(config.categories ?? {}).find(([key]) => fold(key) === fold(category))?.[1];
  const lines = [`Giá thị trường${source ? ` ${source}` : ''}: ${numbers.length >= 3 ? `${tr(numbers[0])}–${tr(numbers[1])}, giữa ` : ''}${tr(middle)}`];
  if (!tiers) lines.push(`Giá thu tối đa: chưa có tỷ lệ lời cho ${category || 'danh mục này'} (thêm vào price-tiers.json)`);
  else {
    const { cost, profit } = maxBuyPrice(middle, tiers);
    if (needsFounder(config, name, middle)) lines.push(`Giá thu: cần Bảo/Nguyên duyệt (hàng hiếm hoặc giá trị cao); theo bảng${staff ? '' : ` lời ${percent(profit)}`} là ${tr(cost)}`);
    // Staff get the price, not the profit rate.
    else lines.push(`Giá thu tối đa: ${tr(cost)}${staff ? '' : ` (lời ${percent(profit)} trên vốn)`} — gợi ý, chưa phải chính sách`);
    if (paid) lines.push(`Giá thu ${tr(paid)}: ${paid <= cost ? 'trong mức gợi ý' : `cao hơn mức gợi ý ${tr(paid - cost)}`}`);
  }
  return reply.replace(line, lines.join('\n'));
}

/** Lot (case 8): one line per product "n. tên | Danh mục: … | Tình trạng: … | Giá thị trường (…): a-b, giữa c" gets its purchase hint, plus a total. */
function withLotPrices(reply, config = loadConfig(), staff = false) {
  let total = 0, priced = 0, items = 0;
  const lines = reply.split('\n').map(line => {
    if (!/^\s*\d+\.\s.*\|\s*Giá thị trường/.test(line)) return line;
    items++;
    const middle = Number(/giữa\s*([\d.,]+)/i.exec(line)?.[1]?.replace(/[.,]/g, ''));
    if (!middle) return `${line} → chưa có giá`;
    const category = /Danh mục:\s*([^|]+?)\s*\|/.exec(line)?.[1] ?? '';
    const tiers = Object.entries(config.categories ?? {}).find(([key]) => fold(key) === fold(category))?.[1];
    const shown = line.replace(/(Giá thị trường[^:]*:).*$/, `$1 giữa ${tr(middle)}`);
    if (!tiers) return `${shown} → chưa có tỷ lệ lời cho ${category || 'danh mục này'}`;
    const { cost } = maxBuyPrice(middle, tiers);
    if (needsFounder(config, line, middle)) return `${shown} → cần Bảo/Nguyên duyệt`;
    total += cost; priced++;
    return `${shown} → thu tối đa ${tr(cost)}`;
  });
  if (!priced) return lines.join('\n');
  const at = lines.findIndex(line => /^Hỏi Bảo:/.test(line.trim()));
  const sum = `Tổng thu tối đa ${priced}/${items} món: ${tr(total)} — gợi ý, chưa phải chính sách${staff ? '' : ' (theo price-tiers.json)'}`;
  if (at < 0) lines.push(sum); else lines.splice(at, 0, sum);
  return lines.join('\n');
}

module.exports = { maxBuyPrice, withBuyPrice, withLotPrices, loadConfig, needsFounder };
