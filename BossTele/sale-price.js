'use strict';

// Bảo 2026-10-19 (TASK-033): BossTele answers "giá sale" with the Sale AI tool's own formula (D:\BaoQ-AI lib/pricing.js
// calculate). P0 comes from Sale AI's store, read as plain files: no store lock, no write, no Kiot call.
// Stock, name and current Kiot price come from the web catalog snapshot, which is fresher than Sale AI's last load.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { cost } = require('./catalog');

const BRANCH = 44466; // Sale AI prices only stock at "Chi nhánh trung tâm".
const defaults = {
  saleDir: process.env.BAOQ_AI_DIR || 'D:/BaoQ-AI',
  catalogFile: path.join(__dirname, '..', 'server', 'data', 'catalog-cache.json'),
};

// Re-read a file only when it changes on disk; the bot keeps running for days.
function cachedByMtime(file, load) {
  let mtime = null, value = null;
  return () => {
    const stat = fs.statSync(file);
    if (stat.mtimeMs !== mtime) { value = load(); mtime = stat.mtimeMs; }
    return value;
  };
}

function readSaleStore(storeDir) {
  const blob = digest => {
    if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error('Kho Sale AI có tham chiếu không hợp lệ.');
    return JSON.parse(fs.readFileSync(path.join(storeDir, 'blobs', `${digest}.json`), 'utf8'));
  };
  const manifest = JSON.parse(fs.readFileSync(path.join(storeDir, 'manifest.json'), 'utf8'));
  if (manifest.format !== 'baoq-split-v1' || !manifest.indexes?.products) throw new Error('Kho Sale AI không đúng định dạng.');
  const products = new Map(blob(manifest.indexes.products).map(blob).map(product => [product.code, product]));
  return { policy: manifest.metadata?.policy ?? null, loadedAt: manifest.metadata?.loadedAt ?? null, products };
}

function createSalePricer({ saleDir = defaults.saleDir, catalogFile = defaults.catalogFile, today } = {}) {
  const storeDir = path.join(saleDir, 'data', 'kiot-state.store');
  const store = cachedByMtime(path.join(storeDir, 'manifest.json'), () => readSaleStore(storeDir));
  const catalog = cachedByMtime(catalogFile, () => new Map((JSON.parse(fs.readFileSync(catalogFile, 'utf8')).rows?.kiotviet ?? []).map(row => [row.sku, row])));
  let pricing;
  return async function salePrices(skus) {
    pricing ??= await import(pathToFileURL(path.join(saleDir, 'lib', 'pricing.js')).href);
    const sale = store();
    let live = new Map();
    try { live = catalog(); } catch { /* no web snapshot: use Sale AI's own stock and price */ }
    const day = today ?? pricing.vietnamTime().date;
    const rows = skus.map(sku => {
      const saved = sale.products.get(sku), row = live.get(sku);
      if (!saved && !row) return { sku, status: 'missing', reasons: ['Không có trong Sale AI và danh mục KiotViet'] };
      const branch = row?.detail?.inventories?.find(inventory => inventory.branchId === BRANCH);
      const product = {
        ...saved, code: sku,
        name: row?.name ?? saved.name, createdAt: row?.detail?.createdDate ?? saved.createdAt,
        currentPrice: row?.price ?? saved.currentPrice,
        active: row ? row.detail?.isActive !== false : saved.active, activeMissing: false,
        stock: row ? (branch?.onHand ?? 0) : saved.stock, inventoryMissing: false,
        // Sale AI sets P0 once from the Kiot price; a product it has not loaded yet gets the same starting value.
        p0: saved?.p0 ?? row?.price,
      };
      const result = pricing.calculate(product, day);
      return { sku, name: product.name, day, type: result.type, ageDays: result.ageDays, m: result.m, p0: product.p0,
        price: result.price, allowance: result.allowance, net: result.net, currentPrice: product.currentPrice,
        stock: product.stock, cost: row && process.env.BOSSTELE_HIDE_COST !== '1' ? cost(row) : null, status: result.status, reasons: result.reasons, p0Source: saved?.p0 ? 'sale-ai' : 'kiot-now' };
    });
    return { day, policy: sale.policy, formulaPolicy: pricing.POLICY, saleLoadedAt: sale.loadedAt, rows };
  };
}

if (require.main === module) {
  const skus = process.argv.slice(2).filter(arg => /^SP\d{4,}$/i.test(arg)).map(sku => sku.toUpperCase());
  if (!skus.length) { console.error('Dùng: node sale-price.js SP014899 [SP000009 ...]'); process.exitCode = 1; }
  else createSalePricer()(skus).then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(`Không đọc được giá sale: ${error.message}`); process.exitCode = 1; });
}

module.exports = { createSalePricer };
