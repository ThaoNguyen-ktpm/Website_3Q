import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { env } from '../config/env.js';
import { editDistance, findBrandTypos } from '../services/assistant/brands.js';
import { chat } from '../services/assistant/graph.js';
import { callModel } from '../services/assistant/model.js';
import { executeTool } from '../services/assistant/tools.js';
import { catalogStore } from '../services/catalogStore.js';

vi.mock('../services/catalogStore.js', () => ({ catalogStore: { brands: vi.fn() } }));
vi.mock('../services/assistant/model.js', () => ({ callModel: vi.fn() }));
vi.mock('../services/assistant/tools.js', () => ({ executeTool: vi.fn(), toolDefinitions: [] }));
const brands = ['Louis Vuitton', 'Gucci', 'Chanel', 'Dior', 'Hermes', 'Balenciaga', 'YSL', 'BVL', 'VCA', 'Bottega', 'MCM', 'Brand lạ'];
beforeEach(() => { vi.resetAllMocks(); env.LLM_BASE_URL = 'http://local.test'; vi.mocked(catalogStore.brands).mockResolvedValue(brands); });
afterEach(() => vi.unstubAllEnvs());

it('computes Damerau-Levenshtein distance including swaps', () => {
  expect(editDistance('chanle', 'chanel')).toBe(1);
  expect(editDistance('hermess', 'hermes')).toBe(1);
  expect(editDistance('gucci', 'gucci')).toBe(0);
});
it.each([
  ['Túi Chanle còn hàng không?', 'Chanle', 'Chanel'],
  ['hàng hermess hot trend', 'hermess', 'Hermes'],
  ['Hermès Birkin', null, null],
  ['túi Gucii mới', 'Gucii', 'Gucci'],
  ['Louis Vuiton Neverfull', 'Louis Vuiton', 'Louis Vuitton'],
  ['Balenciga city bag', 'Balenciga', 'Balenciaga'],
  ['Bvlgari serpenti', null, null],
  ['cho tui 10 sản phẩm chanelel', 'chanelel', 'Chanel'],
  ['hermesss birkin', 'hermesss', 'Hermes'],
  ['diorrr', null, null],
])('%s → %s suggests %s', (question, typed, brand) => {
  const result = findBrandTypos(question, brands);
  if (typed === null) expect(result).toEqual([]);
  else expect(result).toEqual([{ typed, brand }]);
});
it('never "corrects" short names or ordinary words', () => {
  expect(findBrandTypos('MCN có không, giá bao nhiêu, còn hàng dior', brands)).toEqual([]);
  expect(findBrandTypos('Thêm nhân viên ở đâu?', brands)).toEqual([]);
  expect(findBrandTypos('brand la', brands)).toEqual([]);
});
it('fixes a misspelled brand and searches at once, saying what was fixed', async () => {
  const product = { sku: 'SP1', name: 'Túi Chanel Boy', price: 1, onHand: 1, hotTrend: false, image: null };
  vi.mocked(executeTool).mockResolvedValue({ content: JSON.stringify({ total: 1 }), sources: [], products: [product] });
  const result = await chat({ messages: [{ role: 'user', content: 'Túi Chanle còn hàng không?' }] }, []);
  expect(result.reply).toBe('Đã sửa "Chanle" thành "Chanel". Có 1 sản phẩm Chanel, còn hàng phù hợp:');
  expect(executeTool).toHaveBeenCalledWith('tim_san_pham', expect.objectContaining({ brand: 'Chanel', q: 'tui', in_stock: true }), []);
  expect(callModel).not.toHaveBeenCalled();
});
it('pages the fixed list on "mẫu khác"', async () => {
  vi.mocked(executeTool).mockResolvedValue({ content: JSON.stringify({ total: 30 }), sources: [], products: [{ sku: 'SP2', name: 'Túi Chanel 19', price: 1, onHand: 1, hotTrend: false, image: null }] });
  await chat({ messages: [{ role: 'user', content: 'túi chanle' }, { role: 'assistant', content: 'Có 30 sản phẩm' }, { role: 'user', content: 'mẫu khác' }] }, []);
  expect(executeTool).toHaveBeenCalledWith('tim_san_pham', expect.objectContaining({ brand: 'Chanel', offset: 10 }), []);
});
it('asks back with the exact brand when the fixed question is still not a product look-up', async () => {
  const result = await chat({ messages: [{ role: 'user', content: 'Chanle so với Dior thế nào' }] }, []);
  expect(result).toEqual({ reply: 'Có phải bạn muốn tìm "Chanel"?', offTopic: false, sources: [], suggestions: ['Chanel so với Dior thế nào'] });
  expect(callModel).not.toHaveBeenCalled();
});
it('continues normally when the catalog brands cannot be read', async () => {
  vi.mocked(catalogStore.brands).mockRejectedValue(new Error('offline'));
  vi.mocked(callModel).mockResolvedValue({ text: 'OFF', calls: [] });
  expect((await chat({ messages: [{ role: 'user', content: 'Túi Chanle còn hàng không?' }] }, [])).offTopic).toBe(false);
});
