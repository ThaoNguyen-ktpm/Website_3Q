'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createBot } = require('../telegram-bot');
const { REJECT } = require('../lib/chat-commands');

function setup({ ask = async () => 'Còn 1 cái, giá 26.000.000đ.', now = () => 0 } = {}) {
  const sent = [], asked = [], handled = [];
  const api = async (method, body) => { if (method === 'sendMessage') sent.push(body.text); };
  const newSession = () => ({ handle: async text => { handled.push(text); return { message: `đã xử lý ${text}` }; } });
  const bot = createBot({ api, allowFrom: ['7'], newSession, now, ask: async (text, conversation) => { asked.push({ text, ...conversation }); return ask(text); } });
  const say = (text, from = 7, type = 'private') => bot.handleUpdate({ message: { chat: { id: 1, type }, from: { id: from }, text } });
  return { sent, asked, handled, say, bot };
}

test('bot ignores strangers and group chats silently', async () => {
  const { sent, asked, handled, say } = setup();
  await say('túi Chanel còn không', 99);
  await say('túi Chanel còn không', 7, 'group');
  assert.deepEqual([sent, asked, handled], [[], [], []]);
});

test('bot answers commands itself without Claude', async () => {
  const { sent, asked, handled, say } = setup();
  await say('tìm sku SP014899');
  assert.deepEqual(handled, ['tìm sku SP014899']);
  assert.deepEqual(sent, ['đã xử lý tìm sku SP014899']);
  assert.equal(asked.length, 0);
});

test('bot sends free-form store questions to Claude and keeps one conversation for follow-ups', async () => {
  let clock = 0;
  const { sent, asked, say } = setup({ now: () => clock });
  await say('túi Chanel nào còn hàng?');
  await say('mẫu khác');
  clock = 31 * 60 * 1000;
  await say('mẫu khác');
  assert.deepEqual(sent, Array(3).fill('Còn 1 cái, giá 26.000.000đ.'));
  assert.deepEqual(asked.map(a => a.resume), [false, true, false]);
  assert.equal(asked[0].sessionId, asked[1].sessionId);
  assert.notEqual(asked[1].sessionId, asked[2].sessionId);
});

test('bot rejects off-topic text and non-text without calling Claude', async () => {
  const { sent, asked, bot, say } = setup();
  await say('kể chuyện cười đi');
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, photo: [{}] } });
  assert.equal(asked.length, 0);
  assert.ok(sent.every(text => text.startsWith(REJECT)));
  assert.equal(sent.length, 2);
});

test('bot reports Claude failure, starts a fresh conversation next time and splits long replies', async () => {
  let fail = true;
  const { sent, asked, say } = setup({ ask: async () => { if (fail) throw new Error('offline'); return 'x'.repeat(4500); } });
  await say('giá túi Hermes bao nhiêu');
  fail = false;
  await say('giá túi Hermes bao nhiêu');
  assert.equal(sent[0], 'Claude chưa trả lời được, bạn thử lại sau nhé.');
  assert.deepEqual(sent.slice(1).map(text => text.length), [4000, 500]);
  assert.deepEqual(asked.map(a => a.resume), [false, false]);
  assert.notEqual(asked[0].sessionId, asked[1].sessionId);
});

test('bot greets /start with the command list instead of rejecting it', async () => {
  const { sent, asked, handled, say } = setup();
  await say('/start');
  assert.equal(sent.length, 1);
  assert.ok(sent[0].startsWith('Chào bạn, mình là BossTele'));
  assert.ok(sent[0].includes('tìm tên'));
  assert.deepEqual([asked, handled], [[], []]);
});

test('bot shows web code answers as a headline plus photo cards, without Claude (TASK-032)', async () => {
  const calls = [], asked = [], seen = [];
  const api = async (method, body) => {
    if (method === 'sendPhoto' && body.photo.includes('broken')) throw new Error('bad image');
    calls.push([method, body.text ?? body.caption, body.photo ?? null, body.reply_markup ?? null]);
  };
  const products = [
    { sku: 'SP1', name: 'Túi Chanel Boy', price: 93000000, onHand: 1, hotTrend: true, image: 'https://img.test/1.jpg' },
    { sku: 'SP2', name: 'Túi Chanel 19', price: 0, onHand: 0, hotTrend: false, image: null },
    { sku: 'SP3', name: 'Ví Chanel', price: 5000000, onHand: null, hotTrend: false, image: 'https://img.test/broken.jpg' },
  ];
  const quick = async messages => { seen.push(messages); return messages.at(-1).content === 'túi chanel' ? { reply: 'Có 233 sản phẩm túi Chanel phù hợp (hiện 3 món mới nhất):', products } : null; };
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick, ask: async text => { asked.push(text); return 'Claude trả lời'; } });
  const say = text => bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text } });
  await say('túi chanel');
  assert.equal(asked.length, 0);
  assert.deepEqual(calls.filter(call => call[0] !== 'sendChatAction'), [
    ['sendMessage', 'Có 233 sản phẩm túi Chanel phù hợp (hiện 3 món mới nhất):', null, null],
    ['sendPhoto', 'Túi Chanel Boy\nSP1 · 93.000.000đ\nCòn 1 · Hot', 'https://img.test/1.jpg', null],
    ['sendMessage', 'Túi Chanel 19\nSP2 · Chưa có giá\nHết hàng', null, null],
    ['sendMessage', 'Ví Chanel\nSP3 · 5.000.000đ\nKhông quản lý tồn', null, null],
  ]);
  await say('giá túi Hermes so với Chanel thế nào');
  assert.deepEqual(asked, ['giá túi Hermes so với Chanel thế nào']);
  assert.deepEqual(seen.at(-1).map(message => message.role), ['user', 'assistant', 'user']);
  assert.equal(seen.at(-1)[1].content, 'Có 233 sản phẩm túi Chanel phù hợp (hiện 3 món mới nhất):');
});

test('bot turns web suggestions into reply buttons', async () => {
  const markups = [];
  const api = async (method, body) => { if (method === 'sendMessage') markups.push(body.reply_markup); };
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick: async () => ({ reply: 'Có phải bạn muốn tìm "Chanel"?', suggestions: ['túi Chanel'] }) });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'túi chanell' } });
  assert.deepEqual(markups, [{ keyboard: [[{ text: 'túi Chanel' }]], one_time_keyboard: true, resize_keyboard: true }]);
});

test('bot asks Claude when the web lookup finds nothing', async () => {
  const asked = [];
  const bot = createBot({ api: async () => {}, allowFrom: ['7'], newSession: () => null,
    quick: async () => ({ reply: 'Không tìm thấy sản phẩm Chanel, tui, hermes, so trên KiotViet.' }),
    ask: async text => { asked.push(text); return 'Hermes giữ giá tốt hơn.'; } });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'giá túi Hermes so với Chanel thế nào' } });
  assert.deepEqual(asked, ['giá túi Hermes so với Chanel thế nào']);
});

test('bot adds photo cards for SKUs mentioned in a Claude answer', async () => {
  const photos = [];
  const api = async (method, body) => { if (method === 'sendPhoto') photos.push(body.caption); };
  const product = sku => ({ sku, name: `Túi ${sku}`, price: 1000, onHand: 1, hotTrend: false, image: `https://img.test/${sku}.jpg` });
  const quick = async messages => /^SP\d+$/.test(messages.at(-1).content) ? { reply: 'x', products: [product(messages.at(-1).content)] } : null;
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick, ask: async () => 'Nên chọn SP000001 hơn SP000002; SP000001 giữ giá tốt.' });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'túi Chanel nên mua cái nào' } });
  assert.deepEqual(photos, ['Túi SP000001\nSP000001 · 1.000đ\nCòn 1', 'Túi SP000002\nSP000002 · 1.000đ\nCòn 1']);
});

test('bot shows a Claude product list as the headline plus up to 10 photo cards in order', async () => {
  const texts = [], photos = [];
  const api = async (method, body) => { if (method === 'sendMessage') texts.push(body.text); if (method === 'sendPhoto') photos.push(body.photo); };
  const skus = Array.from({ length: 12 }, (_, i) => `SP0248${String(i).padStart(2, '0')}`);
  const quick = async messages => /^SP\d+$/.test(messages.at(-1).content)
    ? { reply: 'x', products: [{ sku: messages.at(-1).content, name: 'Túi', price: 1, onHand: 1, hotTrend: false, image: `https://img.test/${messages.at(-1).content}.jpg` }] } : null;
  const ask = async () => `Có 650 túi Chanel phù hợp (hiện 10 món mới nhất):\nSKU: ${skus.join(', ')}\nNhắn "mẫu khác" để xem thêm.`;
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick, ask });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'cho tui 10 túi chanel đẹp nhất' } });
  assert.deepEqual(texts, ['Có 650 túi Chanel phù hợp (hiện 10 món mới nhất):\nNhắn "mẫu khác" để xem thêm.']);
  assert.deepEqual(photos, skus.slice(0, 10).map(sku => `https://img.test/${sku}.jpg`));
});

test('bot answers "giá sale" with Sale AI prices on the product cards (TASK-033)', async () => {
  const sent = [], lookups = [];
  const api = async (method, body) => { if (method !== 'sendChatAction') sent.push(body.text ?? body.caption); };
  const product = { sku: 'SP014899', name: 'Túi Hermes Garden Party', price: 26000000, onHand: 1, hotTrend: false, image: 'https://img.test/1.jpg' };
  const quick = async messages => { lookups.push(messages.at(-1).content); return { reply: 'Có 1 sản phẩm phù hợp:', products: [product] }; };
  const salePrices = async skus => ({ day: '2026-10-19', rows: skus.map(sku => ({ sku, status: 'simulated', m: 1, type: 'normal', ageDays: 6, p0: 26000000,
    price: 25200000, allowance: 1260000, net: 23940000, currentPrice: 26000000, stock: 1, p0Source: 'sale-ai', reasons: [] })) });
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick, salePrices, ask: async () => assert.fail('no Claude') });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'giá sale SP014899' } });
  assert.deepEqual(lookups, ['SP014899']);
  assert.deepEqual(sent, [
    'Túi Hermes Garden Party\nSP014899 · Còn 1\nGiá sale 19/10: 25.200.000đ (Kiot đang 26.000.000đ)\nBớt thêm tối đa 1.260.000đ (thấp nhất 23.940.000đ)',
  ]);
});

test('bot explains when Sale AI cannot price a product', async () => {
  const sent = [];
  const api = async (method, body) => { if (method !== 'sendChatAction') sent.push(body.text ?? body.caption); };
  const quick = async () => ({ reply: 'x', products: [{ sku: 'SP1', name: 'Ví', price: 0, onHand: 0, hotTrend: false, image: null }] });
  const salePrices = async () => ({ day: '2026-10-19', rows: [{ sku: 'SP1', status: 'excluded', reasons: ['Bỏ qua: hết tồn hoặc ngừng kinh doanh'] }] });
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick, salePrices });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'ví chanel giảm giá được bao nhiêu' } });
  assert.deepEqual(sent, ['Ví\nSP1 · Chưa tính được giá sale: Bỏ qua: hết tồn hoặc ngừng kinh doanh']);
});

test('a pasted multi-line product card asking how much to sell gets the Sale AI card', async () => {
  const sent = [], lookups = [];
  const api = async (method, body) => { if (method !== 'sendChatAction') sent.push(body.text ?? body.caption); };
  const product = { sku: 'SP024867', name: 'Túi Louis Vuitton Slouchy PM', price: 46000000, onHand: 1, hotTrend: false, image: null };
  const quick = async messages => { lookups.push(messages.at(-1).content); return messages.at(-1).content === 'SP024867' ? { reply: 'x', products: [product] } : null; };
  const salePrices = async skus => ({ day: '2026-10-19', rows: skus.map(sku => ({ sku, status: 'simulated', m: 0, type: 'normal', ageDays: 2, p0: 46000000,
    price: 46000000, allowance: 2300000, net: 43700000, currentPrice: 46000000, stock: 1, p0Source: 'kiot-now', reasons: [] })) });
  const bot = createBot({ api, allowFrom: ['7'], newSession: () => null, quick, salePrices, ask: async () => assert.fail('no Claude') });
  for (const text of ['Túi Louis Vuitton Slouchy PM Monogram Canvas Nâu GHW KG "\nSP024867 · 46.000.000đ nên sale giá nhiu là tốt nhất',
    'Túi Louis Vuitton Slouchy PM\nSP024867 · 46.000.000đ\nCòn 1 tui nên bán giá nhiu hợp lý']) {
    await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text } });
  }
  assert.deepEqual(lookups, ['SP024867', 'SP024867']);
  // One message per question; same price as Kiot, so no "Kiot đang" note.
  assert.deepEqual(sent, Array(2).fill('Túi Louis Vuitton Slouchy PM\nSP024867 · Còn 1\nGiá sale 19/10: 46.000.000đ\nBớt thêm tối đa 2.300.000đ (thấp nhất 43.700.000đ)'));
  assert.ok(!sent.some(text => text.startsWith(REJECT)));
});

const fsMemory = require('node:fs'), osMemory = require('node:os'), pathMemory = require('node:path');
const { createMemory } = require('../lib/boss-memory');
const tempMemory = () => createMemory(fsMemory.mkdtempSync(pathMemory.join(osMemory.tmpdir(), 'boss-memory-')));

test('memory commands add, list and forget notes in BOSS.md (TASK-034)', async () => {
  const sent = [], memory = tempMemory();
  const bot = createBot({ api: async (method, body) => { if (method === 'sendMessage') sent.push(body.text); }, allowFrom: ['7'], newSession: () => null, memory,
    ask: async () => assert.fail('no Claude'), quick: async () => assert.fail('no lookup') });
  const say = text => bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text } });
  await say('nhớ: báo giá theo triệu cho gọn');
  await say('Ghi nhớ: khách VIP là chị Lan');
  await say('/nho');
  await say('quên: khách vip');
  await say('bạn nhớ gì?');
  assert.deepEqual(sent, [
    'Đã ghi nhớ: báo giá theo triệu cho gọn',
    'Đã ghi nhớ: khách VIP là chị Lan',
    'Mình đang nhớ:\n1. báo giá theo triệu cho gọn\n2. khách VIP là chị Lan',
    'Đã quên 1 điều có chữ "khách vip".',
    'Mình đang nhớ:\n1. báo giá theo triệu cho gọn',
  ]);
});

test('Claude gets the notes and recent chat, and "GHI NHỚ:" lines are saved', async () => {
  const sent = [], calls = [], memory = tempMemory();
  memory.add('báo giá theo triệu cho gọn');
  const quick = async messages => messages.at(-1).content === 'túi chanel' ? { reply: 'Có 231 sản phẩm Chanel phù hợp:', products: [] } : null;
  const ask = async (text, options) => { calls.push({ text, ...options }); return 'Cái thứ 2 đẹp hơn.\nGHI NHỚ: Bảo thích túi Chanel màu đen'; };
  const bot = createBot({ api: async (method, body) => { if (method === 'sendMessage') sent.push(body.text); }, allowFrom: ['7'], newSession: () => null, memory, quick, ask });
  const say = text => bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text } });
  await say('túi chanel');
  await say('túi nào đẹp hơn, nên chọn cái nào');
  assert.deepEqual(calls[0].notes, ['báo giá theo triệu cho gọn']);
  assert.equal(calls[0].context, 'Bảo: túi chanel\nBot: Có 231 sản phẩm Chanel phù hợp:');
  assert.equal(sent.at(-1), 'Cái thứ 2 đẹp hơn.\n(Đã ghi nhớ: Bảo thích túi Chanel màu đen)');
  assert.deepEqual(memory.notes(), ['báo giá theo triệu cho gọn', 'Bảo thích túi Chanel màu đen']);
});

test('a restarted bot continues the saved conversation', async () => {
  const memory = tempMemory(), seen = [];
  const make = () => createBot({ api: async () => {}, allowFrom: ['7'], newSession: () => null, memory,
    quick: async messages => { seen.push(messages.map(message => message.content)); return { reply: 'Có 10 sản phẩm', products: [] }; } });
  await make().handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'túi chanel' } });
  await make().handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text: 'mẫu khác' } });
  assert.deepEqual(seen.at(-1), ['túi chanel', 'Có 10 sản phẩm', 'mẫu khác']);
});
