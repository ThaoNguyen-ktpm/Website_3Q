'use strict';

// Bảo 2026-10-19: the Telegram Claude reads the same KiotViet catalog as the web search page (snapshot saved by
// the web server, newest first) instead of search-products.js, which returns at most 100 rows in alphabetical order.
const fs = require('node:fs');
const path = require('node:path');

const SNAPSHOT = path.join(__dirname, '..', 'server', 'data', 'catalog-cache.json');
const SORTS = ['newest', 'cheap', 'expensive'];
const fold = text => String(text ?? '').normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
// KiotViet uses 0 for products without a selling price.
const priced = price => (typeof price === 'number' && price > 0 ? price : 0);
const created = row => Date.parse(row.detail?.createdDate ?? '') || 0;
const cost = row => Math.max(0, ...(row.detail?.inventories ?? []).map(inventory => Number(inventory.cost) || 0)) || null;

function parseArgs(args) {
  const options = { q: '', hot: false, inStock: false, sort: 'newest', limit: 10, offset: 0, min: null, max: null };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--hot') options.hot = true;
    else if (flag === '--in-stock') options.inStock = true;
    else if (['--q', '--sort', '--limit', '--offset', '--min', '--max'].includes(flag) && index + 1 < args.length) options[flag.slice(2)] = args[++index];
    else throw new Error(`Tham số không hợp lệ: ${flag}`);
  }
  for (const key of ['limit', 'offset', 'min', 'max']) {
    if (options[key] === null || typeof options[key] === 'number') continue;
    if (!/^\d+$/.test(options[key])) throw new Error(`--${key} phải là số nguyên không âm.`);
    options[key] = Number(options[key]);
  }
  if (!SORTS.includes(options.sort)) throw new Error('--sort là newest, cheap hoặc expensive.');
  options.limit = Math.min(Math.max(options.limit, 1), 30);
  return options;
}

/** Same matching as the web assistant: every word in name, SKU, brand or category; "!" in the name marks Hot trend. */
function searchCatalog(snapshot, options) {
  const words = fold(options.q).split(/\s+/).filter(Boolean);
  const items = (snapshot.rows?.kiotviet ?? []).filter(row => {
    const text = fold(`${row.name} ${row.sku} ${row.detail?.tradeMarkName ?? ''} ${row.detail?.categoryName ?? ''}`);
    const price = priced(row.price);
    return words.every(word => text.includes(word))
      && (!options.hot || String(row.name).includes('!'))
      && (!options.inStock || row.onHand > 0)
      && (options.min === null || price >= options.min)
      && (options.max === null || (price > 0 && price <= options.max));
  });
  const order = {
    newest: (a, b) => created(b) - created(a),
    cheap: (a, b) => (priced(a.price) || Infinity) - (priced(b.price) || Infinity),
    expensive: (a, b) => priced(b.price) - priced(a.price),
  }[options.sort];
  items.sort((a, b) => order(a, b) || String(a.sku).localeCompare(String(b.sku)));
  return {
    total: items.length, syncedAt: snapshot.syncedAt ?? null,
    items: items.slice(options.offset, options.offset + options.limit).map(row => ({
      sku: row.sku, name: row.name, price: priced(row.price) || null, onHand: row.onHand, hot: String(row.name).includes('!'),
      brand: row.detail?.tradeMarkName ?? null, category: row.detail?.categoryName ?? null,
      cost: cost(row),
      // Dates and held quantity for the drafts: sold items' modified ≈ sale date, reserved = kept for a customer (đặt hàng).
      created: row.detail?.createdDate?.slice(0, 10) ?? null, modified: row.detail?.modifiedDate?.slice(0, 10) ?? null,
      reserved: (row.detail?.inventories ?? []).reduce((sum, inventory) => sum + (Number(inventory.reserved) || 0), 0),
    })),
  };
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(SNAPSHOT)) throw new Error('Chưa có danh mục: chạy web (npm run dev tại D:/Website_3Q/Webstie) để đồng bộ KiotViet.');
    console.log(JSON.stringify(searchCatalog(JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')), options)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs, searchCatalog, cost };
