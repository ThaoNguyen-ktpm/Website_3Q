'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createBot } = require('../telegram-bot');
const { createAccess } = require('../lib/telegram-access');

// Bảo 2026-10-20: dmPolicy "pairing": strangers get a code, Bảo approves it on the computer, the bot then answers them.
function setup(policy = 'pairing') {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'tg-access-')), 'access.json');
  fs.writeFileSync(file, JSON.stringify({ dmPolicy: policy, allowFrom: ['7'], groups: {}, pending: {} }));
  let clock = 0;
  const access = createAccess(file, () => clock);
  const sent = [];
  const bot = createBot({ api: async (method, body) => { if (method === 'sendMessage') sent.push([body.chat_id, body.text]); },
    allowFrom: access.allowFrom, pair: access.pairingCode, newSession: () => ({ handle: async text => ({ message: `đã xử lý ${text}` }) }) });
  const say = (from, text) => bot.handleUpdate({ message: { chat: { id: from, type: 'private' }, from: { id: from, first_name: 'Mac' }, text } });
  return { file, access, sent, say, tick: ms => { clock += ms; } };
}

test('a stranger gets one pairing code; after Bảo approves it the bot answers them without a restart', async () => {
  const f = setup();
  await f.say(42, '/start');
  await f.say(42, 'hello');
  const codes = f.sent.map(([, text]) => text.match(/Mã ghép nối: ([A-Z2-9]{6})/)?.[1]);
  assert.equal(codes.length, 2);
  assert.equal(codes[0], codes[1]);
  assert.equal(f.access.approve('nope00'), null);
  assert.deepEqual(f.access.approve(codes[0].toLowerCase()), { senderId: '42', chatId: '42', name: 'Mac', username: null, createdAt: 0 });
  await f.say(42, 'tìm sku SP014899');
  assert.deepEqual(f.sent.at(-1), [42, 'đã xử lý tìm sku SP014899']);
  assert.deepEqual(JSON.parse(fs.readFileSync(f.file, 'utf8')).allowFrom, ['7', '42']);
});

test('codes expire after an hour, and pairing off means strangers stay ignored', async () => {
  const f = setup();
  await f.say(42, '/start');
  const code = f.sent[0][1].match(/Mã ghép nối: (\w+)/)[1];
  f.tick(60 * 60 * 1000);
  assert.equal(f.access.approve(code), null);
  const off = setup('allowlist');
  await off.say(42, '/start');
  assert.deepEqual(off.sent, []);
});
