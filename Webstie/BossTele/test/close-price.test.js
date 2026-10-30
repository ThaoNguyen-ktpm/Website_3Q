'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBot, parseMoney } = require('../telegram-bot');
const { createPriceFeedback } = require('../lib/price-feedback');

test('numeric SKU suffix is never parsed as an offer', () => {
  assert.equal(parseMoney('SP025211_29102026 khách trả 45tr'), 45000000);
  assert.equal(parseMoney('SP025211_29102026'), null);
  assert.equal(parseMoney('SP025211 SP025211_29102026'), null);
});

// TASK-040: "giá chốt" = facts card → customer's offer → one-line suggestion → Bảo's feedback.
const product = { sku: 'SP024640', name: 'Túi Chanel Vanity with Chain Small Đen GHW', price: 65000000, onHand: 1, hotTrend: false, image: null };
const saleRow = { sku: 'SP024640', status: 'simulated', m: 0, type: 'normal', ageDays: 11, price: 65000000, allowance: 0, net: 65000000, currentPrice: 65000000, cost: 51500000, reasons: [] };
function setup({ suggestion = 'Túi mới (M0), chưa vào đợt sale → nên giữ giá, trả ngược 61–62tr', market = null } = {}) {
  const messages = [], prompts = [], markets = [];
  const feedback = createPriceFeedback(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'price-feedback-')), 'feedback.jsonl'));
  const api = async (method, body) => { if (method !== 'sendChatAction') messages.push({ text: body.text ?? body.caption, buttons: body.reply_markup?.keyboard?.flat().map(b => b.text) ?? (body.reply_markup?.remove_keyboard ? 'removed' : null) }); };
  const quick = async items => items.at(-1).content === product.sku ? { reply: 'x', products: [product] } : null;
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick, feedback,
    salePrices: async skus => ({ day: '2026-10-20', rows: skus.map(() => saleRow) }),
    ask: async prompt => { prompts.push(prompt); return suggestion; },
    market: market && (async prompt => { markets.push(prompt); return market; }), rates: async () => null });
  const say = text => bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text } });
  return { messages, prompts, markets, feedback, say };
}

test('giá chốt shows the facts, asks the offer, suggests, and saves "Chưa đúng" feedback for the next time', async () => {
  const f = setup();
  await f.say('SP024640 giá chốt');
  assert.deepEqual(f.messages.splice(0), [
    { text: 'Túi Chanel Vanity with Chain Small Đen GHW\nSP024640 · Còn 1\nĐang bán 65tr · Vốn 51,5tr · Lời 13,5tr (26,2%)\nTồn 11 ngày · M0 · Không Hot · Sale AI chưa cho bớt', buttons: null },
    { text: 'Khách trả bao nhiêu? Gõ số, ví dụ 58tr.', buttons: ['Bỏ qua'] },
  ]);
  await f.say('58tr');
  assert.match(f.prompts[0], /Khách trả 58tr: lời 6,5tr \(12,6%\), thấp hơn giá bán 7tr/);
  assert.match(f.prompts[0], /Chưa có góp ý trước/);
  assert.deepEqual(f.messages.splice(0), [{ text: '58tr: lời 6,5tr (12,6%), thấp hơn giá bán 7tr\nTúi mới (M0), chưa vào đợt sale → nên giữ giá, trả ngược 61–62tr', buttons: ['Hợp lý', 'Chưa đúng'] }]);
  await f.say('Chưa đúng');
  await f.say('60tr, khách quen');
  assert.deepEqual(f.messages.splice(0).map(m => m.text), ['Anh chốt bao nhiêu, vì sao?', 'Đã lưu góp ý: chốt 60tr. Lần sau hỏi mẫu này bot sẽ xét lại.']);
  const [saved] = f.feedback.similar(product);
  assert.deepEqual([saved.sku, saved.offer, saved.verdict, saved.finalPrice, saved.reason, saved.cost, saved.sale.m], ['SP024640', 58000000, 'wrong', 60000000, '60tr, khách quen', 51500000, 0]);
  // The next question about the same model carries that feedback to Claude.
  await f.say('SP024640 khách trả 59tr');
  assert.match(f.prompts[1], /Bảo chốt 60tr vì 60tr, khách quen/);
});

test('"Hợp lý" is saved, "Bỏ qua" ends the exchange, and a follow-up without SKU uses the last product', async () => {
  const f = setup();
  await f.say('SP024640 giá chốt');
  await f.say('khách trả 62 triệu');
  await f.say('Hợp lý');
  assert.equal(f.feedback.similar(product).at(-1).verdict, 'ok');
  assert.equal(f.messages.at(-1).text, 'Đã ghi nhận: gợi ý hợp lý.');
  await f.say('thế giá chốt tốt nhất nên là nhiu');
  assert.match(f.messages.at(-2).text, /^Túi Chanel Vanity/);
  await f.say('Bỏ qua');
  assert.deepEqual(f.messages.at(-1), { text: 'Đã bỏ qua.', buttons: 'removed' });
  assert.equal(f.prompts.length, 1);
});

test('the market button looks the product up, then asks the offer again', async () => {
  const f = setup({ market: 'Giá thị trường: 55–70tr' });
  await f.say('SP024640 giá chốt');
  assert.deepEqual(f.messages.at(-1).buttons, ['Tra giá thị trường', 'Bỏ qua']);
  await f.say('Tra giá thị trường');
  assert.match(f.markets[0], /SP024640/);
  assert.deepEqual(f.messages.slice(-2).map(m => m.text), ['Giá thị trường: 55–70tr', 'Khách trả bao nhiêu? Gõ số, ví dụ 58tr.']);
});

test('customer prices are read in the ways Bảo types them; SKUs and percentages are not prices', () => {
  assert.deepEqual(['58tr', '58,5 triệu', '58tr5', '58.000.000', '58', 'chốt 60 vì khách quen 2 năm'].map(parseMoney), [58e6, 58.5e6, 58.5e6, 58e6, 58e6, 60e6]);
  assert.deepEqual(['SP024640 giá chốt lời 10%', 'không biết'].map(parseMoney), [null, null]);
});

test('a slow Claude answer shows a live "Đang suy nghĩ" line, then deletes it before the answer', async () => {
  const calls = [];
  const api = async (method, body) => { calls.push([method, body.text ?? body.message_id ?? '']); return method === 'sendMessage' ? { message_id: calls.length } : true; };
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, thinkMs: 20,
    ask: () => new Promise(resolve => setTimeout(() => resolve('Còn 1 cái.'), 90)) });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'túi Chanel nào còn hàng?' } });
  const shown = calls.filter(([method]) => method !== 'sendChatAction');
  assert.match(shown[0][1], /^•{1,3} \d+s · Đang suy nghĩ$/);
  assert.ok(shown.some(([method]) => method === 'editMessageText'));
  const deleted = shown.findIndex(([method]) => method === 'deleteMessage');
  assert.ok(deleted > 0 && deleted < shown.findIndex(([, text]) => text === 'Còn 1 cái.'));
});

test('"Chưa đúng" still works after the bot restarts in the middle of a closing-price exchange', async () => {
  const { createMemory } = require('../lib/boss-memory');
  const memory = createMemory(fs.mkdtempSync(path.join(os.tmpdir(), 'close-memory-')));
  const texts = [];
  const make = () => createBot({ api: async (method, body) => { if (method === 'sendMessage') texts.push(body.text); }, allowFrom: ['7'], newSession: () => null, memory,
    quick: async items => items.at(-1).content === product.sku ? { reply: 'x', products: [product] } : null,
    salePrices: async () => ({ day: '2026-10-20', rows: [saleRow] }), ask: async () => 'Giữ giá → trả ngược 62tr' });
  const say = (bot, text) => bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text } });
  const before = make();
  await say(before, 'SP024640 giá chốt');
  await say(before, '58');
  await say(make(), 'Chưa đúng');
  assert.equal(texts.at(-1), 'Anh chốt bao nhiêu, vì sao?');
});

test('a product a customer has a deposit on shows as held, not for sale (case 10)', async () => {
  const captions = [];
  const held = { ...product, reserved: 1 };
  const bot = createBot({ api: async (method, body) => { if (method === 'sendMessage') captions.push(body.text); }, allowFrom: ['7'], newSession: () => null,
    quick: async () => ({ reply: 'Có 1 sản phẩm phù hợp:', products: [held] }), ask: async () => assert.fail('no Claude') });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'túi chanel vanity' } });
  assert.match(captions.at(-1), /Đang giữ cho khách \(đã cọc\)/);
});
