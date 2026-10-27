'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { stockGaps, stockGapText } = require('../lib/stock-gap');

// Bảo 2026-10-20 case 9: the website still sells what Kiot no longer has.
const kiot = [
  { sku: 'SP1', name: 'Túi đã bán', onHand: 0, detail: { inventories: [{ onHand: 0, reserved: 0 }] } },
  { sku: 'SP2', name: 'Túi đang giữ', onHand: 1, detail: { inventories: [{ onHand: 1, reserved: 1 }] } },
  { sku: 'SP3', name: 'Túi còn bán', onHand: 1, detail: { inventories: [{ onHand: 1, reserved: 0 }] } },
  { sku: 'SP4', name: 'Túi web đã ẩn', onHand: 0, detail: { inventories: [] } },
];
const web = (sku, onHand, publishedOn = '2026-10-01') => ({ sku, onHand, detail: { publishedOn, webUrl: `https://shop.test/${sku}` } });

test('sold-out or held on Kiot but still on sale on the website', () => {
  const gaps = stockGaps(kiot, [web('SP1', null), web('SP2', 1), web('SP3', 1), web('SP4', 1, null), web('SP1', 0)]);
  assert.deepEqual(gaps.map(gap => [gap.sku, gap.reason]), [['SP1', 'Kiot đã hết'], ['SP2', 'khách đã cọc giữ']]);
  assert.match(stockGapText(gaps), /^Web còn bán 2 món[\s\S]*- SP1 Túi đã bán \(Kiot đã hết\) https:\/\/shop\.test\/SP1[\s\S]*bot không tự sửa/);
  assert.match(stockGapText([]), /^Web và Kiot khớp/);
});
