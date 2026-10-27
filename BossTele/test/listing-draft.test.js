'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBot } = require('../telegram-bot');
const { draftRequest, draftSkill } = require('../lib/listing-draft');
const { imageBlock } = require('../lib/market-lookup');

// Bảo 2026-10-20: product photo → draft for Kiot or the website; draft only, nothing is written.
function skills() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'skills-'));
  for (const name of ['baoq-up-kiot', 'dang-san-pham-baoq', 'dang-giay-baoq']) {
    fs.mkdirSync(path.join(dir, 'org', name), { recursive: true });
    fs.writeFileSync(path.join(dir, 'org', name, 'SKILL.md'), `---\nname: ${name}\n---\nHướng dẫn ${name}`);
  }
  return dir;
}

test('the caption picks the skill: Kiot by default, "web" for the website, shoes have their own', () => {
  assert.deepEqual(['giá thu 45tr, fullbox', 'đăng web giúp', 'web giày Nike', ''].map(draftSkill),
    ['baoq-up-kiot', 'dang-san-pham-baoq', 'dang-giay-baoq', 'baoq-up-kiot']);
  const request = draftRequest('giá thu 45tr', new Date('2026-10-20T03:00:00Z'), skills());
  assert.match(request.system, /^CHẾ ĐỘ CHỈ SOẠN NHÁP/);
  assert.match(request.system, /Hướng dẫn baoq-up-kiot$/);
  assert.match(request.prompt, /Bảo ghi kèm: giá thu 45tr/);
  assert.throws(() => draftRequest('', new Date(), fs.mkdtempSync(path.join(os.tmpdir(), 'none-'))), /chưa có skill baoq-up-kiot/);
});

test('a text question "nên thu giá bao nhiêu" gets the reference price and the purchase hint, no photo needed', async () => {
  const sent = [], calls = [];
  const bot = createBot({ api: async (method, body) => { if (method === 'sendMessage') sent.push(body.text); }, allowFrom: ['7'], newSession: () => null,
    ask: async () => assert.fail('no chat Claude'), quick: async () => assert.fail('no web lookup'),
    draft: async (prompt, options) => { calls.push({ prompt, ...options }); return 'Tên: Túi Chanel Vanity\nDanh mục: Túi\nTình trạng: chưa rõ (tính như LN 95%)\n'
      + 'Giá thị trường (Kiot): 59000000-65000000, giữa 62000000, 3 món: SP1, SP2, SP3\n\nSources:\n- [a](https://a.test)'; } });
  const say = text => bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, text } });
  await say('túi Chanel Vanity nên thu giá bao nhiêu');
  assert.match(calls[0].prompt, /không có ảnh: túi Chanel Vanity nên thu giá bao nhiêu/);
  assert.match(calls[0].system, /^CHẾ ĐỘ CHỈ TRA GIÁ/);
  assert.match(calls[0].bash[0], /catalog\.js:\*$/);
  assert.equal(calls[0].image, undefined);
  assert.equal(sent[0], 'Đang tra giá thu, khoảng 1–3 phút…');
  assert.match(sent[1], /Giá thị trường \(Kiot\): 59tr–65tr, giữa 62tr\nGiá thu tối đa: 47,6tr \(lời 30% trên vốn\)/);
  assert.doesNotMatch(sent[1], /Sources|Giá thu 22tr/);
  // An amount right after "thu" is checked against the hint; a model number ("22") is not an amount.
  await say('Chanel 22 thu vào 50tr được không');
  assert.match(sent.at(-1), /Giá thu 50tr: cao hơn mức gợi ý 2,4tr/);
});

test('the Sources list after a web search is dropped', () => {
  const { withoutSources } = require('../lib/listing-draft');
  assert.equal(withoutSources('Tên: Túi\nHỏi Bảo:\n1. Size?\n\nSources:\n- [a](https://a.test)'), 'Tên: Túi\nHỏi Bảo:\n1. Size?');
});

test('Telegram photos (application/octet-stream) still reach Claude as JPEG', async () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const block = await imageBlock('https://api.telegram.org/file/botX/p.jpg', async () => new Response(jpeg, { headers: { 'content-type': 'application/octet-stream' } }));
  assert.equal(block.source.media_type, 'image/jpeg');
});

test('a photo gets a draft with the skill guide, and the reply says nothing was written', async () => {
  const sent = [], calls = [];
  const bot = createBot({ api: async (method, body) => { if (method === 'sendMessage') sent.push(body.text); }, allowFrom: ['7'], newSession: () => null,
    fileUrl: async id => `https://files.test/${id}.jpg`, draft: async (prompt, options) => { calls.push({ prompt, ...options }); return 'Túi Chanel Vanity Small\nMã dòng: BAG-CHA-VAN [Cần xác nhận]'; } });
  await bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, caption: 'giá thu 45tr', photo: [{ file_id: 'small' }, { file_id: 'big' }] } });
  assert.deepEqual(calls[0].image, ['https://files.test/big.jpg']); // a list since albums send several photos
  assert.match(calls[0].system, /CHẾ ĐỘ CHỈ SOẠN NHÁP/);
  assert.equal(sent[0], 'Đang soạn nháp lên Kiot, khoảng 1–3 phút…');
  assert.match(sent[1], /Mã dòng: BAG-CHA-VAN[\s\S]*\(Bản nháp — chưa ghi lên đâu cả\. Thấy đúng thì chép vào Kiot\.\)$/);
});

test('an album is drafted once: same product from all angles, or with "lô" one line and hint per product plus a total (case 8)', async () => {
  const sent = [], calls = [];
  const bot = createBot({ api: async (method, body) => { if (method === 'sendMessage') sent.push(body.text); }, allowFrom: ['7'], newSession: () => null, albumMs: 20,
    fileUrl: async id => `https://files.test/${id}.jpg`,
    draft: async (prompt, options) => { calls.push({ prompt, ...options }); return calls.length === 1 ? 'Tên: Túi Chanel Vanity\nHỏi Bảo:\n1. Size?'
      : '1. Chanel Vanity | Danh mục: Túi | Tình trạng: LN | Giá thị trường (Kiot): 59000000-65000000, giữa 62000000\n2. LV Speedy | Danh mục: Túi | Tình trạng: 90% | Giá thị trường (Kiot): 20000000-26000000, giữa 23000000\nHỏi Bảo:\n1. Có bill không?'; } });
  const photo = (id, group, caption) => bot.handleUpdate({ message: { chat: { id: 1, type: 'private' }, from: { id: 7 }, media_group_id: group, photo: [{ file_id: id }], ...(caption ? { caption } : {}) } });
  await photo('a1', 'g1', 'túi chanel');
  await photo('a2', 'g1');
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].image, ['https://files.test/a1.jpg', 'https://files.test/a2.jpg']);
  assert.match(calls[0].prompt, /^2 ảnh của cùng một món/);
  await photo('b1', 'g2', 'lô 2 món khách bán');
  await photo('b2', 'g2');
  await new Promise(resolve => setTimeout(resolve, 60));
  assert.match(calls[1].prompt, /mỗi ảnh là một món khác nhau/);
  assert.match(sent.at(-1), /→ thu tối đa 47,6tr[\s\S]*→ thu tối đa 17,6tr\nTổng thu tối đa 2\/2 món: 65,2tr/);
});
