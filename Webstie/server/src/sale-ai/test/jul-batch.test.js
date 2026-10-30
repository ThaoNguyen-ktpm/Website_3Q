import test from 'node:test';
import assert from 'node:assert/strict';
import { calculate } from '../lib/pricing.js';
import { Simulator } from '../lib/service.js';
import { LiveService } from '../lib/live.js';

const item = (createdAt, hot = false, extra = {}) => ({ code: 'BATCH', name: hot ? 'Túi !' : 'Túi',
  createdAt, p0: 35e6, currentPrice: 33e6, active: true, stock: 1, notes: 'Ghi chú gốc', ...extra });

// Literal dates and expected steps from TASK-105, independent of the calculator.
for (const [created, hot, day, m] of [
  ['2026-07-01', false, '2026-10-31', 0],
  ['2026-07-01', false, '2026-11-01', 1],
  ['2026-08-20', false, '2026-11-16', 2],
  ['2026-08-20', true, '2026-11-01', 1],
  ['2026-10-15', false, '2026-11-30', 2],
  ['2026-10-15', false, '2026-12-01', 3],
  ['2026-10-15', false, '2026-12-16', 4],
  ['2026-10-15', false, '2026-12-31', 5],
  ['2026-10-15', false, '2027-01-15', 6],
  ['2026-10-15', false, '2027-03-01', 6],
  ['2026-10-16', false, '2026-10-31', 1],
  ['2026-10-16', true, '2026-11-29', 0],
  ['2026-10-16', true, '2026-11-30', 1],
  ['2026-10-20', false, '2026-10-29', 0],
]) test(`${created}${hot ? ' hot' : ''} on ${day} is M${m}`, () => {
  const row = calculate(item(created, hot), day);
  assert.equal(row.status, 'simulated');
  assert.equal(row.m, m);
  const prices = [35e6, 34.2e6, 33.4e6, 32.4e6, 31.4e6, 30.4e6, 29.4e6];
  const rights = [1750000, 1710000, 1670000, 972000, 0, 0, 0];
  assert.equal(row.price, prices[m]);
  assert.equal(row.allowance, rights[m]);
  if (created <= '2026-10-15') assert.equal(row.saleStartDate, '2026-11-01');
});

test('pre-July items are excluded without any proposed price or note, including saved manual pricing', () => {
  for (const created of ['2026-03-15', '2026-06-30']) for (const day of ['2026-10-01', '2026-11-01', '2027-01-15']) {
    for (const extra of [{}, { p0: 700e6, manualPricing: { price: 665e6, allowance: 19950000 } }]) {
      const product = item(created, true, extra), before = structuredClone(product);
      const row = calculate(product, day);
      assert.equal(row.status, 'excluded');
      assert.match(row.reasons.join(), /Hàng tạo trước 01\/07\/2026: không giảm/);
      for (const key of ['m', 'price', 'allowance', 'net']) assert.equal(row[key], null);
      assert.equal(row.markdown, undefined);
      assert.equal(row.notePreview, undefined);
      assert.deepEqual(product, before);
    }
  }
});

test('batch age starts on November 1 and pre-batch evaluation remains M0', () => {
  for (const [day, age, m] of [['2026-10-31', 0, 0], ['2026-11-01', 0, 1], ['2026-11-16', 15, 2]]) {
    const row = calculate(item('2026-07-01'), day);
    assert.equal(row.ageDays, age); assert.equal(row.m, m); assert.equal(row.dateStatus, 'valid');
  }
});

test('July and October boundaries use Vietnam calendar dates', () => {
  assert.equal(calculate(item('2026-06-30T16:59:59Z'), '2026-11-01').status, 'excluded');
  assert.equal(calculate(item('2026-06-30T17:00:00Z'), '2026-11-01').m, 1);
  assert.equal(calculate(item('2026-10-15T16:59:59Z', true), '2026-11-01').m, 1);
  assert.equal(calculate(item('2026-10-15T17:00:00Z', true), '2026-11-01').m, 0);
});

test('new cohorts retain validation and manual pricing guards', () => {
  for (const created of ['2026-03-15', '2026-07-01', '2026-10-16']) {
    assert.equal(calculate(item(created, false, { p0: 0 }), '2026-11-01').status, 'waiting');
    assert.equal(calculate(item(created), '2026-09-30').status, 'waiting');
    assert.equal(calculate(item(created, false, { stock: 0 }), '2026-11-01').status, 'excluded');
  }
  for (const created of ['bad', '2026-02-30', '2026-11-02']) assert.equal(calculate(item(created), '2026-11-01').status, 'waiting');
  for (const created of ['2026-07-01', '2026-10-16']) {
    assert.match(calculate(item(created, false, { p0: 700e6 }), '2026-11-01').reasons.join(), /giá duyệt riêng/);
    assert.equal(calculate(item(created, false, { p0: 700e6, manualPricing: { price: 665e6, allowance: 19950000 } }), '2026-11-01').price, 665e6);
  }
});

test('excluded pre-July product cannot enter update preparation', async () => {
  const state = { policy: 'old', dataRevision: 1, products: [item('2026-03-15', false, { id: 1 })], runs: [], prepared: [], updates: [] };
  const store = { read: async () => structuredClone(state), write: async () => {} };
  const service = new Simulator(store, { load: async () => { throw Error('No network'); } }, () => new Date('2026-11-01T03:00:00Z'));
  await service.initialize();
  const live = new LiveService(service, { product: async () => { throw Error('No network'); } }, service.clock);
  service.live = live;
  live.timingSink = () => {};
  const run = await service.run('2026-11-01');
  // TASK-109 omits this exclusion from new tables while keeping the product.
  assert.deepEqual(service.state.runs[0].rows, []);
  assert.equal(service.state.runs[0].hiddenBeforeNoMarkdownCount, 1);
  assert.equal(service.state.products.length, 1);
  await assert.rejects(live.prepare(run.id, ['BATCH']), /chưa đủ điều kiện/);
  assert.deepEqual(service.state.prepared, []);
  await assert.rejects(live.prepare(run.id, [], { continueOnError: true, excludedCodes: ['BATCH'] }), /Danh sách món chờ đã thay đổi/);
});
