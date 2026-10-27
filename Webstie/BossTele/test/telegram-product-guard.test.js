'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { allowProductMessage } = require('../lib/telegram-product-guard');
const { patchTelegramServer } = require('../scripts/install-telegram-product-guard');
const { REJECT } = require('../lib/chat-commands');

test('Telegram blocks off-topic messages before forwarding, even after a valid product command', async () => {
  const replies = [], forwarded = [];
  const ctx = { reply: async text => replies.push(text) };
  for (const text of ['tìm tên "Chanel"', 'tôi muốn đi chơi z', 'toi muon di choi z', 'Chanel; kể chuyện', 'tìm tên "Chanel"; kể chuyện']) {
    if (await allowProductMessage(ctx, text)) forwarded.push(text);
  }
  assert.deepEqual(forwarded, ['tìm tên "Chanel"']);
  assert.equal(replies.length, 4);
  assert.ok(replies.every(text => text.startsWith(REJECT)));
});

test('Telegram allows existing product commands and blocks attachments with valid captions', async () => {
  let replies = 0;
  const ctx = { reply: async () => { replies++; } };
  for (const text of ['tìm sku SP022466', 'xem thêm', 'chọn 2', 'tính giá vốn=100 chi_phí=0 cách=markup tỷ_lệ=10', 'phân tích giá', 'trợ giúp']) {
    assert.equal(await allowProductMessage(ctx, text), true);
  }
  assert.equal(replies, 0);
  assert.equal(await allowProductMessage(ctx, 'tìm tên "Chanel"', true), false);
  assert.equal(replies, 1);
});

test('failed Telegram rejection never falls through to Claude', async () => {
  await assert.rejects(allowProductMessage({ reply: async () => { throw new Error('offline'); } }, 'đi chơi'), /offline/);
});

test('plugin patch keeps access/permission gates first and filters before download and model notification', () => {
  const source = [
    'async function handleInbound(ctx, text, downloadImage, attachment) {',
    '  const result = gate(ctx)',
    '  if (result.action !== "deliver") return',
    '  if (PERMISSION_REPLY_RE.test(text)) return',
    '  // Typing indicator — signals "processing" until we reply (or ~5s elapses).',
    '  const imagePath = downloadImage ? await downloadImage() : undefined',
    '  mcp.notification({ content: text })',
    '}',
  ].join('\n');
  for (const eol of ['\n', '\r\n']) {
    const patched = patchTelegramServer(source.replaceAll('\n', eol));
    assert.ok(patched.indexOf('PERMISSION_REPLY_RE') < patched.indexOf('allowProductMessage'));
    assert.ok(patched.indexOf('await allowProductMessage') < patched.indexOf('await downloadImage'));
    assert.ok(patched.indexOf('await allowProductMessage') < patched.indexOf('mcp.notification'));
    assert.equal(patchTelegramServer(patched), patched);
    const oldPath = patched.replace(/require\("[^"]+"\)/, 'require("D:/BossTele/lib/telegram-product-guard.js")');
    assert.equal(patchTelegramServer(oldPath), patched);
  }
  assert.throws(() => patchTelegramServer('upstream changed'), /đổi cấu trúc/);
});

test('Telegram forwards free-form BaoQ store questions and still blocks off-topic ones (TASK-029)', async () => {
  let replies = 0;
  const ctx = { reply: async () => { replies++; } };
  const store = ['túi Chanel nào đang bán chạy?', 'SP014899 lời bao nhiêu', 'tui xach hermes con hang ko', 'doanh thu tháng này thế nào', 'mẫu khác'];
  for (const text of store) assert.equal(await allowProductMessage(ctx, text), true, text);
  assert.equal(replies, 0);
  const offTopic = ['đi chơi với bạn', 'gia đình tôi khỏe', 'cho ví dụ bài thơ', 'giải thích đơn giản về vũ trụ', 'túi Chanel; kể chuyện', `túi Chanel ${'a'.repeat(500)}`];
  for (const text of offTopic) assert.equal(await allowProductMessage(ctx, text), false, text);
  assert.equal(await allowProductMessage(ctx, 'túi Chanel nào đang bán chạy?', true), false);
  assert.equal(replies, offTopic.length + 1);
});

test('free-form questions may span several lines (pasted product cards)', async () => {
  const { storeQuestion } = require('../lib/telegram-product-guard');
  assert.equal(storeQuestion('Túi Louis Vuitton Slouchy PM\nSP024867 · 46.000.000đ\nCòn 1 tui nên bán giá nhiu hợp lý'), true);
  assert.equal(storeQuestion('túi Chanel\u0007 kể chuyện'), false);
});

test('market look-ups pass the guard even without a brand or price word', () => {
  const { storeQuestion } = require('../lib/telegram-product-guard');
  for (const text of ['tìm con này trên thị trường', 'check giá ngoài giúp', 'tham khảo giá resale']) assert.equal(storeQuestion(text), true, text);
});

test('asking about Vietnamese shops and luxury resale is in scope (Bảo 2026-10-21)', () => {
  const { storeQuestion } = require('../lib/telegram-product-guard');
  const { marketIntent } = require('../lib/market-lookup');
  for (const text of ['bạn có thể tra sàn việt nam của các shop giống tui', 'tra con Vanity trên sàn Việt Nam', 'các shop khác bán Vanity giá nhiêu'])
    assert.equal(storeQuestion(text) && marketIntent(text), true, text);
  assert.equal(storeQuestion('đồ hiệu secondhand ở VN giá sao'), true);
  // "sẵn" folds to "san": only the accented "sàn" means a marketplace.
  for (const text of ['túi Chanel có sẵn không', 'sản phẩm mới']) assert.equal(marketIntent(text), false, text);
});
