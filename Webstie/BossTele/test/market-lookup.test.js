'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createBot } = require('../telegram-bot');
const { marketIntent, marketPrompt, splitReply, exchangeRates, imageBlock, guide } = require('../lib/market-lookup');

const CARD = 'Túi Chanel Vanity with Chain Small Đen GHW Hộp 9/10/2026 "- - KG Chị Tuyền 17/10\nSP024640 · 65.000.000đ\nCòn 1 tìm thông tin con này trên thị trường';

test('market intent catches "trên thị trường" style requests but not normal shop questions', () => {
  for (const text of [CARD, 'check giá ngoài con SP024640', 'giá tham khảo túi Hermes Birkin 30', 'giá hãng bao nhiêu', 'con nay tren mang ban bao nhieu', 'Fashionphile có không'])
    assert.equal(marketIntent(text), true, text);
  for (const text of ['túi Chanel nào còn hàng?', 'giá hàng SP024640', 'SP014899 lời bao nhiêu', 'giá sale SP014899', 'nên bán giá nhiu hợp lý'])
    assert.equal(marketIntent(text), false, text);
});

test('market prompt carries the shop listing (no cost) and rates; reply splits on --- lines', () => {
  const prompt = marketPrompt({ text: CARD, rates: '1 USD = 26.300đ (open.er-api.com, 20/10/2026)', today: new Date('2026-10-20T05:00:00Z'),
    products: [{ sku: 'SP024640', name: 'Túi Chanel Vanity', price: 65000000, onHand: 1, cost: 51500000 }] });
  assert.match(prompt, /Ngày tra: 20\/10\/2026/);
  assert.match(prompt, /SP024640 · Túi Chanel Vanity · giá niêm yết 65\.000\.000đ · còn 1/);
  assert.match(prompt, /1 USD = 26\.300đ/);
  assert.doesNotMatch(prompt, /51\.500\.000|51500000/);
  assert.deepEqual(splitReply('A\n---\nB\n\n ---- \nC\n---'), ['A', 'B', 'C']);
  assert.match(guide(), /^# Tra giá thị trường/);
});

test('exchange rates come back as VND per unit, or null when the API fails', async () => {
  const fake = async () => ({ json: async () => ({ result: 'success', time_last_update_unix: 1792454552, rates: { USD: 1, VND: 26300, EUR: 0.9, JPY: 150 } }) });
  const text = await exchangeRates(fake);
  assert.match(text, /^1 USD = 26\.300đ; 1 EUR = 29\.222đ; 1 JPY = 175đ \(open\.er-api\.com, 20\/10\/2026\)$/);
  assert.equal(await exchangeRates(async () => { throw new Error('offline'); }), null);
});

test('a pasted card asking for the market goes to the market look-up, not the card or sale answer', async () => {
  const sent = [], prompts = [], lookups = [];
  const api = async (method, body) => { if (method === 'sendMessage') sent.push([body.text, body.link_preview_options ?? null]); };
  const product = { sku: 'SP024640', name: 'Túi Chanel Vanity with Chain Small Đen GHW', price: 65000000, onHand: 1, hotTrend: false, image: 'https://img.test/vanity.jpg' };
  const quick = async messages => { lookups.push(messages.at(-1).content); return { reply: 'Có 1 sản phẩm SP024640 phù hợp:', products: [product] }; };
  const market = async (prompt, options) => { prompts.push(prompt); assert.deepEqual(options, { image: 'https://img.test/vanity.jpg' }); return '🔎 Chanel Vanity\n---\n🔗 Nguồn\n1. x\n---\n📊 So với shop: Hợp lý'; };
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick, market, rates: async () => '1 USD = 26.300đ',
    salePrices: async () => assert.fail('no sale'), ask: async () => assert.fail('no Claude chat') });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: CARD } });
  assert.deepEqual(lookups, ['SP024640']);
  assert.match(prompts[0], /SP024640 · Túi Chanel Vanity with Chain Small Đen GHW · giá niêm yết 65\.000\.000đ/);
  const off = { is_disabled: true };
  assert.deepEqual(sent, [['Đang tra giá thị trường, khoảng 1–3 phút…', null], ['🔎 Chanel Vanity', off], ['🔗 Nguồn\n1. x', off], ['📊 So với shop: Hợp lý', off]]);
});

test('market look-up failure gives one short apology', async () => {
  const sent = [];
  const bot = createBot({ api: async (method, body) => { if (method === 'sendMessage') sent.push(body.text); }, allowFrom: ['7'], newSession: () => null,
    market: async () => { throw new Error('timeout'); } });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'check giá ngoài túi Hermes Picotin 18' } });
  assert.deepEqual(sent, ['Đang tra giá thị trường, khoảng 1–3 phút…', 'Chưa tra được giá thị trường, bạn thử lại sau nhé.']);
});

test('product photo becomes a base64 image block; non-images and failures are skipped', async () => {
  const reply = (type, bytes = 3) => async () => ({ ok: true, headers: new Map([['content-type', type]]), arrayBuffer: async () => new Uint8Array(bytes).buffer });
  assert.deepEqual(await imageBlock('https://img.test/1.jpeg', reply('image/jpeg')), { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAAA' } });
  assert.equal(await imageBlock('https://img.test/1.html', reply('text/html')), null);
  assert.equal(await imageBlock(null), null);
  assert.equal(await imageBlock('https://img.test/x', async () => { throw new Error('offline'); }), null);
});
