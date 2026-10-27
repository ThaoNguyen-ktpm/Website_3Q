import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { productQuery } from '../services/assistant/router.js';
import { chat } from '../services/assistant/graph.js';
import { callModel } from '../services/assistant/model.js';
import { executeTool } from '../services/assistant/tools.js';
import { catalogStore } from '../services/catalogStore.js';

vi.mock('../services/catalogStore.js', () => ({ catalogStore: { brands: vi.fn() } }));
vi.mock('../services/assistant/model.js', () => ({ callModel: vi.fn() }));
vi.mock('../services/assistant/tools.js', () => ({ executeTool: vi.fn(), toolDefinitions: [] }));
const brands = ['Louis Vuitton', 'Chanel', 'Hermes', 'Gucci', 'Dior'];
const card = (sku: string) => ({ sku, name: `Túi ${sku} !`, price: 1, onHand: 1, hotTrend: true, image: null });
beforeEach(() => { vi.resetAllMocks(); env.LLM_BASE_URL = 'http://local.test'; vi.mocked(catalogStore.brands).mockResolvedValue(brands); });
afterEach(() => vi.unstubAllEnvs());

it.each([
  ['mẫu hot chanel', { sku: null, brand: 'Chanel', hot: true, words: [] }],
  ['cho tui danh sách hottrend của LV', { sku: null, brand: 'Louis Vuitton', hot: true, words: [] }],
  ['Chanel Classic Flap còn không', { sku: null, brand: 'Chanel', hot: false, words: ['classic', 'flap'] }],
  ['SP024215 giá bao nhiêu', { sku: 'SP024215', brand: null, hot: false, words: [] }],
  ['hàng hot trend', { sku: null, brand: null, hot: true, words: [] }],
])('routes "%s" to a direct catalog lookup', (question, expected) => {
  expect(productQuery(question, brands)).toMatchObject(expected);
});
it.each(['Thêm nhân viên ở đâu?', 'Vốn 31 triệu markup 15% bán bao nhiêu', 'Thời tiết hôm nay',
  'giá túi Hermes so với Chanel thế nào', 'So sánh túi Chanel và Dior', 'túi LV khác gì túi Gucci', 'Hermes hay Chanel giữ giá',
  'nên mua túi Chanel nào', 'ví Dior có tốt hơn không', 'LV vs Gucci', 'SP014899 có nên mua không'])('leaves "%s" to the assistant', question => {
  expect(productQuery(question, brands)).toBeNull();
});
it('answers product look-ups from the catalog without asking the model', async () => {
  vi.mocked(executeTool).mockResolvedValue({ content: JSON.stringify({ items: [], total: 2 }), sources: [{ kind: 'product', label: 'SP1 · a' }], products: [card('SP1'), card('SP2')] });
  const result = await chat({ messages: [{ role: 'user', content: 'mẫu hot chanel' }] }, ['products.view']);
  expect(result).toMatchObject({ reply: 'Có 2 sản phẩm Hot trend Chanel phù hợp:', offTopic: false, products: [card('SP1'), card('SP2')] });
  expect(executeTool).toHaveBeenCalledWith('tim_san_pham', expect.objectContaining({ q: null, hot_trend: true, brand: 'Chanel', offset: 0 }), ['products.view']);
  expect(callModel).not.toHaveBeenCalled();
});
it('lets the model answer comparisons instead of searching the catalog', async () => {
  vi.mocked(callModel).mockResolvedValueOnce({ text: 'ON', calls: [] }).mockResolvedValueOnce({ text: 'Hermes thường giữ giá tốt hơn.', calls: [] });
  const result = await chat({ messages: [{ role: 'user', content: 'giá túi Hermes so với Chanel thế nào' }] }, ['products.view']);
  expect(result.reply).not.toMatch(/^Không tìm thấy sản phẩm/);
  expect(executeTool).not.toHaveBeenCalled();
  expect(callModel).toHaveBeenCalled();
});
it('says nothing was found instead of inventing products', async () => {
  vi.mocked(executeTool).mockResolvedValue({ content: JSON.stringify({ items: [], total: 0 }), sources: [], products: [] });
  expect((await chat({ messages: [{ role: 'user', content: 'mẫu hot chanel' }] }, ['products.view'])).reply).toBe('Không tìm thấy sản phẩm Hot trend Chanel trên KiotViet.');
});
it.each([
  'Có 1 sản phẩm: Chanel Classic Flap Bag (SKU: CH001), tồn 50, giá 1.200.000 VND.',
  'Giá là 35.000.000đ.',
  'Tồn kho: 3 chiếc.',
])('blocks a model reply that cites data without a lookup: %s', async text => {
  vi.mocked(callModel).mockResolvedValueOnce({ text: 'ON', calls: [] }).mockResolvedValueOnce({ text, calls: [] });
  const result = await chat({ messages: [{ role: 'user', content: 'Tư vấn giúp mình cách chọn quà tặng sang trọng' }] }, ['products.view']);
  expect(result.reply).toBe('Mình chưa tra được dữ liệu cho câu này. Bạn hỏi rõ tên thương hiệu, tên hoặc SKU sản phẩm giúp mình nhé.');
});

it('pages the previous product list for follow-ups like "mẫu khác" and "xem thêm"', async () => {
  const { resolveProductQuery } = await import('../services/assistant/router.js');
  const history = [
    { role: 'user', content: 'túi Chanel' }, { role: 'assistant', content: 'Có 230 sản phẩm…' },
    { role: 'user', content: 'mẫu khác' }, { role: 'assistant', content: 'Thêm…' }, { role: 'user', content: 'xem thêm' },
  ];
  expect(resolveProductQuery(history, brands)).toMatchObject({ brand: 'Chanel', words: ['tui'], offset: 20 });
  expect(resolveProductQuery(history.slice(0, 3), brands)).toMatchObject({ brand: 'Chanel', offset: 10 });
  expect(resolveProductQuery([{ role: 'user', content: 'mẫu khác' }], brands)).toBeNull();
  expect(resolveProductQuery([...history.slice(0, 2), { role: 'user', content: 'Thêm nhân viên ở đâu?' }], brands)).toBeNull();
  expect(resolveProductQuery([...history.slice(0, 2), { role: 'user', content: 'so với mẫu khác' }], brands)).toBeNull();
});
it.each([
  ['túi Hermes dưới 50 triệu', { brand: 'Hermes', maxPrice: 50_000_000, minPrice: null, words: ['tui'] }],
  ['túi LV từ 30 đến 60 triệu còn hàng', { brand: 'Louis Vuitton', minPrice: 30_000_000, maxPrice: 60_000_000, inStock: true }],
  ['Gucci còn hàng rẻ nhất', { brand: 'Gucci', inStock: true, sort: 'cheap', words: [] }],
  ['đồng hồ Dior đắt nhất', { brand: 'Dior', sort: 'expensive', words: ['dong', 'ho'] }],
  ['cho tui xem hàng Dior', { brand: 'Dior', words: [] }],
  ['túi Chanel', { brand: 'Chanel', words: ['tui'] }],
  ['túi chanel còn hàng', { brand: 'Chanel', inStock: true, words: ['tui'] }],
  ['SP014899', { sku: 'SP014899' }],
  ['túi rẻ nhất', { brand: null, sort: 'cheap', words: ['tui'] }],
])('reads filters from "%s"', (question, expected) => {
  expect(productQuery(question, brands)).toMatchObject(expected);
});

it.each([
  ['tuí chanel', ['tui']],
  ['tui chanel con hang khong', ['tui']],
  ['tui xach hermes', ['tui']],
  ['tui muon xem chanel', []],
  ['giay gucci size 38', ['giay']],
])('bag and size words: %s → %j', (question, words) => {
  expect(productQuery(question, brands)?.words).toEqual(words);
});
