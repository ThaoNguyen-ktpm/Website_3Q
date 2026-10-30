'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { extractSkus, matchingSkus } = require('../lib/sku');
const { createBot } = require('../telegram-bot');

test('recognizes full codes without matching inside alphanumeric strings', () => {
  assert.deepEqual(extractSkus('sp025211_kg SP025306_29102026 (SP000009) XSP025211_KG SP025211KG SP123'), ['SP025211_KG', 'SP025306_29102026', 'SP000009']);
});

test('exact SKU wins; base fallback never guesses between variants or another suffix', () => {
  const items = ['SP025211_KG', 'SP025211_29102026', 'SP0252110_KG'].map(sku => ({ sku }));
  assert.deepEqual(matchingSkus(items, 'sp025211_kg'), [items[0]]);
  assert.deepEqual(matchingSkus(items, 'SP025211'), items.slice(0, 2));
  assert.deepEqual(matchingSkus(items, 'SP025211_MISSING'), []);
  assert.deepEqual(matchingSkus([...items, { sku: 'SP025211' }], 'SP025211'), [{ sku: 'SP025211' }]);
});

function setup(products, { reply = 'Có sản phẩm', sale = false } = {}) {
  const sent = [], priced = [], looked = [];
  const bot = createBot({ allowFrom: ['7'], newSession: () => null,
    api: async (method, body) => { if (method === 'sendMessage') sent.push(body.text); },
    quick: async messages => { looked.push(messages.at(-1).content); return { reply, products }; },
    ask: async () => 'Bạn cho mình SKU (ví dụ SP014899)',
    salePrices: sale ? async skus => { priced.push(...skus); return { day: '2026-10-30', rows: skus.map(sku => ({ sku, status: 'excluded', reasons: ['không giảm'] })) }; } : null });
  return { sent, priced, looked, say: text => bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text } }) };
}
const card = sku => ({ sku, name: 'Túi', price: 50000000, onHand: 1, image: null });

test('closing-price cards accept suffixed and unique base codes', async () => {
  for (const sku of ['sp025211_kg', 'SP025211', 'SP000009']) {
    const full = sku === 'SP000009' ? sku : 'SP025211_KG';
    const f = setup([card(full)]);
    await f.say(`${sku} giá chốt`);
    assert.ok(f.sent.some(text => text.includes(`${full} ·`)));
    assert.ok(f.sent.some(text => text.startsWith('Khách trả bao nhiêu')));
  }
});

test('sale uses the resolved full SKU and ambiguous closing/sale asks for a choice', async () => {
  const f = setup([card('SP025211_KG')], { sale: true });
  await f.say('SP025211 giá sale');
  assert.deepEqual(f.priced, ['SP025211_KG']);
  for (const intent of ['giá chốt', 'giá sale']) {
    const f = setup([card('SP024387_23092026'), card('SP024387_KG')], { sale: true });
    await f.say(`SP024387 ${intent}`);
    assert.match(f.sent.join('\n'), /chọn.*SP024387_23092026.*SP024387_KG/);
    assert.deepEqual(f.priced, []);
    assert.ok(!f.sent.some(text => text.startsWith('Khách trả bao nhiêu')));
  }
});

test('assistant-only example never supplies a closing SKU', async () => {
  const f = setup([], { reply: 'Bạn cho mình SKU (ví dụ SP014899)' });
  await f.say('xem giá vốn');
  await f.say('giá chốt');
  assert.ok(!f.looked.includes('SP014899'));
});
