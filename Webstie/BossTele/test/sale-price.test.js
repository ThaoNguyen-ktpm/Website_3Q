'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { createSalePricer } = require('../sale-price');

const saleAi = process.env.BAOQ_AI_DIR || path.join(__dirname, '..', '..', 'server', 'src', 'sale-ai');
const hasSaleAi = fs.existsSync(path.join(saleAi, 'lib', 'pricing.js'));

// A throw-away Sale AI folder: its store holds our products, its lib is the real Sale AI pricing code.
function fixture(products, catalogRows) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sale-ai-'));
  const store = path.join(dir, 'data', 'kiot-state.store');
  fs.mkdirSync(path.join(store, 'blobs'), { recursive: true });
  const put = value => {
    const text = JSON.stringify(value), digest = createHash('sha256').update(text).digest('hex');
    fs.writeFileSync(path.join(store, 'blobs', `${digest}.json`), text);
    return digest;
  };
  const index = put(products.map(put));
  fs.writeFileSync(path.join(store, 'manifest.json'), JSON.stringify({ format: 'baoq-split-v1', metadata: { policy: 'baoq-2026-10-14-step15-v7', loadedAt: '2026-10-11T05:48:35.539Z' }, indexes: { products: index } }));
  fs.symlinkSync(path.join(saleAi, 'lib'), path.join(dir, 'lib'), 'junction');
  const catalogFile = path.join(dir, 'catalog.json');
  fs.writeFileSync(catalogFile, JSON.stringify({ rows: { kiotviet: catalogRows } }));
  return { saleDir: dir, catalogFile };
}
const saved = (code, p0, createdAt, name = 'Túi Chanel') => ({ code, name, p0, currentPrice: p0, createdAt, active: true, stock: 1 });
const live = (sku, price, onHand, createdDate, name = 'Túi Chanel') => ({ sku, name, price, onHand, detail: { createdDate, isActive: true, inventories: [{ branchId: 44466, onHand }] } });

test('sale price follows the Sale AI skill example: P0 35tr, regular, M3', { skip: !hasSaleAi }, async () => {
  const paths = fixture([saved('SP1', 35000000, '2026-09-01T10:00:00')], [live('SP1', 34200000, 1, '2026-09-01T10:00:00')]);
  const { rows } = await createSalePricer({ ...paths, today: '2026-12-01' })(['SP1']);
  assert.equal(rows[0].m, 3);
  assert.equal(rows[0].price, 32400000);
  assert.equal(rows[0].allowance, 972000);
  assert.equal(rows[0].net, 31428000);
  assert.equal(rows[0].currentPrice, 34200000);
  assert.equal(rows[0].p0Source, 'sale-ai');
});

test('hottrend uses the longer M0 and P0 stays from Sale AI even when Kiot price dropped', { skip: !hasSaleAi }, async () => {
  const paths = fixture([saved('SP2', 35000000, '2026-10-16T10:00:00', 'Túi Dior !')], [live('SP2', 30000000, 1, '2026-10-16T10:00:00', 'Túi Dior !')]);
  const { rows } = await createSalePricer({ ...paths, today: '2026-10-19' })(['SP2']);
  assert.deepEqual([rows[0].type, rows[0].m, rows[0].price, rows[0].p0], ['hottrend', 0, 35000000, 35000000]);
});

test('new Kiot items use the current price as P0; sold-out and unknown items explain why', { skip: !hasSaleAi }, async () => {
  const paths = fixture([saved('SP3', 10000000, '2026-09-01T10:00:00')], [live('SP4', 20000000, 1, '2026-10-15T10:00:00'), live('SP3', 10000000, 0, '2026-09-01T10:00:00')]);
  const { rows } = await createSalePricer({ ...paths, today: '2026-10-19' })(['SP4', 'SP3', 'SP9']);
  assert.deepEqual([rows[0].p0Source, rows[0].p0, rows[0].m, rows[0].price], ['kiot-now', 20000000, 0, 20000000]);
  assert.equal(rows[1].status, 'excluded');
  assert.equal(rows[2].status, 'missing');
});

test('pre-July items explain không giảm without an error or sale price', { skip: !hasSaleAi }, async () => {
  const paths = fixture([saved('SP5', 35000000, '2026-03-15'), saved('SP6', 35000000, '2026-06-30', 'Túi !')], []);
  const { rows, formulaPolicy } = await createSalePricer({ ...paths, today: '2027-01-15' })(['SP5', 'SP6']);
  assert.equal(formulaPolicy, 'baoq-2026-10-30-hide-before-jul-v10');
  for (const row of rows) {
    assert.equal(row.status, 'excluded');
    assert.match(row.reasons.join(), /không giảm/);
    assert.deepEqual([row.m, row.price, row.allowance, row.net], [null, null, null, null]);
  }
});

test('July-October hot items use November batch steps without the 45-day delay', { skip: !hasSaleAi }, async () => {
  const paths = fixture([saved('SP7', 35000000, '2026-08-20', 'Túi !')], []);
  for (const [today, m, price] of [['2026-10-31', 0, 35000000], ['2026-11-01', 1, 34200000], ['2026-11-16', 2, 33400000]]) {
    const { rows } = await createSalePricer({ ...paths, today })(['SP7']);
    assert.equal(rows[0].status, 'simulated');
    assert.equal(rows[0].m, m);
    assert.equal(rows[0].price, price);
  }
});

test('sale pricing resolves base and lowercase codes, prioritizes exact and reports ambiguity', { skip: !hasSaleAi }, async () => {
  const codes = ['SP025211_KG', 'SP024387_23092026', 'SP024387_KG', 'SP000009', 'SP000009_KG'];
  const paths = fixture(codes.map(code => saved(code, 35000000, '2026-10-15')), codes.map(code => live(code, 35000000, 1, '2026-10-15')));
  const { rows } = await createSalePricer({ ...paths, today: '2026-10-30' })(['SP025211', 'sp025211_kg', 'SP024387', 'SP000009', 'SP025211_OTHER']);
  assert.deepEqual(rows.slice(0, 2).map(row => row.sku), ['SP025211_KG', 'SP025211_KG']);
  assert.equal(rows[0].price, rows[1].price);
  assert.equal(rows[2].status, 'ambiguous');
  assert.deepEqual(rows[2].candidates, ['SP024387_23092026', 'SP024387_KG']);
  assert.equal(rows[2].price, undefined);
  assert.equal(rows[3].sku, 'SP000009');
  assert.equal(rows[4].status, 'missing');
});
