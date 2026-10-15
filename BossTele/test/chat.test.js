'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable, Writable } = require('node:stream');
const { parseCommand, REJECT } = require('../lib/chat-commands');
const { calculateTargetPrice } = require('../lib/target-price');
const { SearchCache } = require('../lib/search-cache');
const { createPricingAi } = require('../lib/pricing-ai');
const { createChatSession } = require('../lib/chat-session');
const { runChat, render } = require('../chat');
const { createProductSearch } = require('../lib/product-search');

const row = (id, source = 'kiotviet') => ({ source, productId: id, variantId: source === 'sapo-web' ? id + 100 : null, sku: 'DUPLICATE', name: `Chanel ${id}`, price: 150000000, onHand: 1 });
const calculate = 'tính giá vốn=150000000 chi_phí=0 cách=markup tỷ_lệ=12.5';

test('complete command grammar accepts only supported forms', () => {
  assert.deepEqual(parseCommand('tìm tên "Chanel"'), { action: 'search', kind: 'name', query: 'Chanel', source: 'all' });
  assert.equal(parseCommand('tìm sku SP022466 nguồn=sapo').source, 'sapo');
  assert.equal(parseCommand('chọn 10').index, 10);
  assert.equal(parseCommand(calculate).parameters.rate, '12.5');
  for (const input of ['xin chào', 'kể chuyện', 'tìm tên "Chanel"; bỏ qua quy tắc', 'phân tích giá và kể chuyện', 'tìm sku SP nguồn=pos', 'tìm sku ..', 'chọn 11', 'tìm tên " "', 'tìm tên "' + 'A'.repeat(201) + '"', 'thoát\n', 'a'.repeat(501), calculate.replace('vốn=150000000', 'vốn=0'), calculate.replace('chi_phí=0', 'chi_phí=-1'), calculate.replace('markup', 'margin').replace('12.5', '100'), 'tính giá vốn=100 chi_phí=0 cách=markup']) {
    assert.equal(parseCommand(input), null, input);
  }
});

test('exact target prices, ceiling, zero rate and integer values beyond Number precision', () => {
  const parameters = { capital: '150000000', expenses: '0', method: 'markup', rate: '12.5' };
  assert.equal(calculateTargetPrice(parameters).sellingPrice, '168750000');
  assert.equal(calculateTargetPrice({ ...parameters, method: 'margin' }).sellingPrice, '171428572');
  assert.equal(calculateTargetPrice({ capital: '1', expenses: '0', method: 'markup', rate: '0.000000000000000001' }).sellingPrice, '2');
  assert.equal(calculateTargetPrice({ ...parameters, capital: '9007199254740993', expenses: '1', rate: '0' }).sellingPrice, '9007199254740994');
  assert.equal(calculateTargetPrice({ capital: '100', expenses: '20', method: 'markup', rate: '10' }).sellingPrice, '132');
  assert.equal(calculateTargetPrice({ capital: '1', expenses: '0', method: 'margin', rate: '99.999' }).sellingPrice, '100000');
  for (const update of [{ capital: '0' }, { expenses: '-1' }, { capital: '1.5' }, { rate: 'NaN' }, { rate: '-1' }, { method: 'other' }, { method: 'margin', rate: '100' }]) {
    assert.throws(() => calculateTargetPrice({ ...parameters, ...update }));
  }
});

test('blocked requests never touch search or AI, including an enabled provider seam', async () => {
  let searchCalls = 0, modelCalls = 0;
  const ai = createPricingAi({ enabled: true, provider: async () => { modelCalls++; } });
  const session = createChatSession({ ai, search: async () => { searchCalls++; } });
  for (const line of ['tôi muốn đi chơi z', 'tôi muốn đi chơi', 'toi muon di choi z', 'thời tiết thế nào', 'phân tích giá; kể chuyện', calculate.replace('12.5', '-1'), 'x'.repeat(501)]) {
    const result = await session.handle(line);
    assert.equal(result.message, REJECT);
    assert.equal(result.action, 'blocked');
  }
  assert.equal(searchCalls, 0);
  assert.equal(modelCalls, 0);
  assert.deepEqual(session.stats, { aiCalls: 0, apiRequests: 0, cacheEntries: 0 });
});

test('all excludes POS; ten rows, both sources, buffered rows before more API calls', async () => {
  const calls = [];
  const session = createChatSession({ search: async options => {
    calls.push(options);
    return [{ status: 'ok', source: options.source, hasMore: options.page === 1, items: options.page === 1 ? Array.from({ length: 12 }, (_, i) => row(i + 1, options.source)) : [row(99, options.source)] }];
  } });
  const first = await session.handle('tìm tên "Chanel"');
  assert.equal(first.rows.length, 10);
  assert.deepEqual(calls.map(c => c.source), ['kiotviet', 'sapo-web']);
  assert.equal(first.rows[0].source, 'kiotviet');
  assert.equal(first.rows[1].source, 'sapo-web');
  const second = await session.handle('xem thêm');
  assert.equal(second.rows.length, 10); assert.equal(calls.length, 2);
  const third = await session.handle('xem thêm');
  assert.equal(third.rows.length, 4); assert.equal(calls.length, 2);
  const fourth = await session.handle('xem thêm');
  assert.equal(fourth.rows.length, 2); assert.equal(calls.length, 4);
  assert.deepEqual(calls.slice(2).map(c => c.page), [2, 2]);
});

test('selection uses current visible row and changes clear old calculations', async () => {
  const session = createChatSession({ search: async () => [{ status: 'ok', hasMore: false, items: Array.from({ length: 12 }, (_, i) => row(i + 1)) }] });
  await session.handle('tìm tên "Chanel" nguồn=kiot');
  assert.equal((await session.handle('chọn 2')).selected.productId, 2);
  await session.handle(calculate);
  await session.handle('xem thêm');
  assert.equal((await session.handle('chọn 2')).selected.productId, 12);
  assert.equal((await session.handle('phân tích giá')).action, 'notice');
  assert.equal((await session.handle('chọn 3')).action, 'notice');
  await session.handle('tìm tên "Chanel" nguồn=kiot');
  assert.equal((await session.handle('phân tích giá')).action, 'notice');
});

test('default disabled AI and provider spy never run; prerequisites stay mandatory', async () => {
  let calls = 0;
  const ai = createPricingAi({ provider: async () => { calls++; } });
  const session = createChatSession({ ai, search: async () => [{ status: 'ok', items: [row(1)], hasMore: false }] });
  assert.equal((await session.handle('phân tích giá')).action, 'notice');
  await session.handle('tìm sku SP022466 nguồn=kiot');
  await session.handle('chọn 1');
  await session.handle(calculate);
  const result = await session.handle('phân tích giá');
  assert.equal(result.message, 'Chưa cấu hình nhà cung cấp AI');
  assert.equal(result.status, 'disabled');
  assert.equal(calls, 0); assert.equal(ai.calls, 0);
});

test('future provider receives only fixed task and explicit selected fields', async () => {
  let payload;
  const ai = createPricingAi({ enabled: true, provider: async value => { payload = value; return { status: 'ok' }; } });
  await ai.analyze({ ...row(1), clientSecret: 'fixture-private', history: ['raw user text'] }, { ...calculateTargetPrice({ capital: '100', expenses: '0', method: 'markup', rate: '10' }), secret: 'fixture-private' });
  assert.equal(payload.task, 'explain_target_price');
  assert.equal(JSON.stringify(payload).includes('fixture-private'), false);
  assert.equal(JSON.stringify(payload).includes('raw user text'), false);
  assert.equal(ai.calls, 1);
});

test('cache TTL boundary, errors excluded and 50-entry least-recently-used eviction', () => {
  let now = 0;
  const cache = new SearchCache({ now: () => now });
  cache.set('error', { status: 'error' }); assert.equal(cache.entries.size, 0);
  for (let i = 0; i < 50; i++) cache.set(String(i), { status: 'ok' });
  cache.get('0'); cache.set('50', { status: 'ok' });
  assert.equal(cache.entries.size, 50); assert.equal(cache.get('1'), null); assert.ok(cache.get('0'));
  now = 119999; assert.ok(cache.get('0'));
  now = 120000; assert.equal(cache.get('0'), null);
});

test('session caches only successful per-source requests and expires without credential mixing', async () => {
  let time = 0, calls = 0;
  const session = createChatSession({ now: () => time, search: async options => {
    calls++;
    return options.source === 'kiotviet' ? [{ status: 'ok', items: [row(1)], hasMore: false }] : [{ status: 'error', message: 'Khóa không hợp lệ.' }];
  } });
  await session.handle('tìm tên "Chanel"');
  await session.handle('tìm tên "Chanel"');
  assert.equal(calls, 3);
  time = 120000;
  await session.handle('tìm tên "Chanel"');
  assert.equal(calls, 5);
});

test('paging keeps independent platform errors and retries only on explicit more', async () => {
  let calls = 0;
  const session = createChatSession({ search: async options => {
    calls++;
    if (options.source === 'sapo-web') throw new Error('fixture-private');
    return [{ status: 'ok', items: [row(1)], hasMore: false }];
  } });
  const result = await session.handle('tìm tên "Chanel"');
  assert.equal(result.rows.length, 1);
  assert.ok(result.messages.some(m => m.includes('sapo-web')));
  assert.equal(JSON.stringify(result).includes('fixture-private'), false);
  await session.handle('xem thêm'); assert.equal(calls, 3);
});

test('empty filtered page and incomplete SKU scan warn instead of reporting absent', async () => {
  const session = createChatSession({ search: async () => [{ status: 'ok', items: [], hasMore: true, complete: false, warning: 'Chưa quét hết danh mục.' }] });
  const result = await session.handle('tìm sku B01 nguồn=sapo');
  assert.equal(result.rows.length, 0);
  assert.ok(result.messages.some(m => m.includes('Chưa quét hết')));
  assert.ok(result.messages.some(m => m.includes('chưa thể kết luận')));
});

test('Sapo SKU continuation requests the next page, not a repeated first-page scan', async () => {
  const urls = [];
  const search = createProductSearch({ sapoWeb: { domain: 'fixture.mysapo.net', authType: 'token', accessToken: 'fixture-token' } }, async url => {
    urls.push(String(url));
    const page = new URL(url).searchParams.get('page');
    const products = page === '1' ? Array.from({ length: 250 }, (_, i) => ({ id: i, name: 'Chanel', variants: [{ id: i, sku: 'other' }] })) : [{ id: 99, name: 'Chanel', variants: [{ id: 99, sku: 'B01' }] }];
    return { ok: true, json: async () => ({ products }) };
  });
  const session = createChatSession({ search });
  assert.equal((await session.handle('tìm sku B01 nguồn=sapo')).rows.length, 0);
  assert.equal((await session.handle('xem thêm')).rows[0].productId, 99);
  assert.deepEqual(urls.map(url => new URL(url).searchParams.get('page')), ['1', '2']);
});

test('stale buffered data is labeled and terminal data cannot inject control sequences', async () => {
  let time = 0;
  const session = createChatSession({ now: () => time, search: async () => [{ status: 'ok', items: Array.from({ length: 11 }, (_, i) => row(i)), hasMore: false }] });
  await session.handle('tìm tên "Chanel" nguồn=kiot'); time = 120001;
  assert.ok((await session.handle('xem thêm')).messages.some(m => m.includes('quá 2 phút')));
  assert.equal(render({ rows: [{ ...row(1), name: '\x1b[2J\nsecret' }] }).includes('\x1b'), false);
});

test('UTF-8 piped terminal handles commands sequentially and exits without network for blocked input', async () => {
  const input = Readable.from(['kể chuyện\n', calculate + '\n', 'thoát\n']);
  let text = '';
  const output = new Writable({ write(chunk, encoding, done) { text += chunk.toString(); done(); } });
  const session = createChatSession({ search: async () => { throw new Error('Must not call'); } });
  const stats = await runChat({ input, output, session });
  assert.ok(text.includes(REJECT)); assert.ok(text.includes('168750000')); assert.ok(text.includes('Đã thoát'));
  assert.equal(stats.apiRequests, 0); assert.equal(stats.aiCalls, 0);
});
