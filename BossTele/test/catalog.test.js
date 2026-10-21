'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, searchCatalog } = require('../catalog');

const row = (sku, name, price, onHand, createdDate, extra = {}) => ({ sku, name, price, onHand, detail: { createdDate, tradeMarkName: 'Chanel', inventories: [{ cost: 10 }, { cost: 20 }], ...extra } });
const snapshot = { syncedAt: '2026-10-19T03:47:23.057Z', rows: { kiotviet: [
  row('SP1', 'Túi Chanel Classic', 100, 1, '2026-01-01'),
  row('SP2', 'Túi Chanel Boy !', 300, 0, '2026-03-01'),
  row('SP3', 'Ví Hermes', 0, 2, '2026-02-01', { tradeMarkName: 'Hermes' }),
  row('SP4', 'Balo Chanel Duma', 200, 3, '2026-02-15'),
] } };
const skus = options => searchCatalog(snapshot, parseArgs(options)).items.map(item => item.sku);

test('catalog matches every word on folded name, SKU or brand, newest first', () => {
  assert.deepEqual(skus(['--q', 'tui chanel']), ['SP2', 'SP1']);
  assert.deepEqual(skus(['--q', 'CHANEL']), ['SP2', 'SP4', 'SP1']);
  assert.deepEqual(skus(['--q', 'hermes']), ['SP3']);
  const result = searchCatalog(snapshot, parseArgs(['--q', 'chanel', '--limit', '1']));
  assert.equal(result.total, 3);
  assert.equal(result.syncedAt, '2026-10-19T03:47:23.057Z');
  assert.deepEqual(result.items[0], { sku: 'SP2', name: 'Túi Chanel Boy !', price: 300, onHand: 0, hot: true, brand: 'Chanel', category: null, cost: 20,
    // Bảo 2026-10-20: dates and held quantity for the photo drafts.
    created: '2026-03-01', modified: null, reserved: 0 });
});

test('catalog filters hot, stock and price and sorts unpriced items last', () => {
  assert.deepEqual(skus(['--hot']), ['SP2']);
  assert.deepEqual(skus(['--in-stock']), ['SP4', 'SP3', 'SP1']);
  assert.deepEqual(skus(['--min', '150', '--max', '250']), ['SP4']);
  assert.deepEqual(skus(['--sort', 'cheap']), ['SP1', 'SP4', 'SP2', 'SP3']);
  assert.deepEqual(skus(['--sort', 'expensive', '--offset', '1', '--limit', '2']), ['SP4', 'SP1']);
});

test('catalog rejects bad arguments', () => {
  assert.throws(() => parseArgs(['--sort', 'random']), /newest/);
  assert.throws(() => parseArgs(['--limit', '-1']), /số nguyên/);
  assert.throws(() => parseArgs(['--drop']), /không hợp lệ/);
  assert.equal(parseArgs(['--limit', '500']).limit, 30);
});

test('staff chats (BOSSTELE_HIDE_COST=1) never get the cost', () => {
  process.env.BOSSTELE_HIDE_COST = '1';
  try { assert.equal(searchCatalog(snapshot, parseArgs(['--q', 'chanel', '--limit', '1'])).items[0].cost, null); }
  finally { delete process.env.BOSSTELE_HIDE_COST; }
});
