import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { quickAnswer } from '../services/assistant/graph.js';
import { catalogStore } from '../services/catalogStore.js';
import { callModel } from '../services/assistant/model.js';

vi.mock('../services/catalogStore.js', () => ({ catalogStore: { products: vi.fn(), brands: vi.fn() } }));
vi.mock('../services/assistant/model.js', () => ({ callModel: vi.fn() }));

const item = (sku: string, onHand: number | null, name = 'Túi LV Carryall !') => ({
  sku, name, onHand, reserved: 0, price: 30_000_000,
  kiot: { tradeMarkName: 'Louis Vuitton', inventories: [{ cost: 20_000_000, reserved: 0 }] },
});
const ask = (content: string, history: { role: string; content: string }[] = []) =>
  quickAnswer({ messages: [...history, { role: 'user', content }] }, ['products.view', 'products.cost']);
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(catalogStore.brands).mockResolvedValue(['Louis Vuitton']);
  vi.stubGlobal('fetch', vi.fn(() => { throw Error('Network forbidden'); }));
});
afterEach(() => vi.unstubAllGlobals());
const catalog = (items: ReturnType<typeof item>[]) => {
  vi.mocked(catalogStore.products).mockResolvedValue({ items, total: items.length, syncedAt: 'test', sources: {} } as any);
};

it('filters names, stock and brands before totals and pagination, preserving reserved items', async () => {
  const available = Array.from({ length: 12 }, (_, i) => item(`SP${String(i + 1).padStart(6, '0')}`, 1));
  available[0].kiot.inventories[0].reserved = 1;
  catalog([...available, item('SP000013', 0), item('SP000014', -1), item('SP000015', null),
    item('SP000016', 1, 'Ví LV !'), { ...item('SP000017', 1), kiot: { tradeMarkName: 'Chanel', inventories: [] } }]);
  const result = await ask('túi LV');
  expect(result?.reply).toBe('Có 12 sản phẩm Louis Vuitton còn hàng (hiện 10 món mới nhất):');
  expect(result?.products?.map(p => p.sku)).toEqual(['SP000001', 'SP000002', 'SP000003', 'SP000004', 'SP000005', 'SP000006', 'SP000007', 'SP000008', 'SP000009', 'SP000010']);
  expect(result?.products?.[0].reserved).toBe(1);
  const page = await ask('mẫu khác', [{ role: 'user', content: 'túi LV' }]);
  expect(page?.products?.map(p => p.sku)).toEqual(['SP000011', 'SP000012']);
  expect(page?.reply).toBe('Thêm sản phẩm Louis Vuitton (11–12 / 12):');
  expect(callModel).not.toHaveBeenCalled();
});

it('keeps hot, keyword and price filters when counting an entirely sold-out list', async () => {
  catalog([item('SP000001', 0), item('SP000002', -1), item('SP000003', 1, 'Túi LV Neverfull !'),
    { ...item('SP000004', 1), price: 60_000_000 }, item('SP000005', 1, 'Túi LV Carryall')]);
  const result = await ask('túi LV Carryall hot dưới 50 triệu');
  expect(result?.reply).toBe('Có 2 sản phẩm Hot trend Louis Vuitton, tui, carryall, dưới 50 triệu nhưng đều đã hết hàng.');
  expect(result?.products ?? []).toEqual([]);
  expect(result?.sources).toEqual([]);
  expect(catalogStore.products).toHaveBeenCalledTimes(2);
});

it('keeps the original no-match reply when both lookups are empty', async () => {
  catalog([item('SP000001', 1, 'Ví LV')]);
  const result = await ask('túi LV');
  expect(result?.reply).toBe('Không tìm thấy sản phẩm Louis Vuitton, tui trên KiotViet.');
  expect(result?.products ?? []).toEqual([]);
  expect(catalogStore.products).toHaveBeenCalledTimes(2);
});

it('keeps the existing unfiltered behavior for explicit sold-out questions', async () => {
  catalog([item('SP000001', 0), item('SP000002', 1)]);
  const result = await ask('túi LV nào hết hàng');
  expect(result?.products?.map(p => p.sku)).toEqual(['SP000001', 'SP000002']);
  expect(result?.reply).toBe('Có 2 sản phẩm Louis Vuitton phù hợp:');
  expect(catalogStore.products).toHaveBeenCalledTimes(1);
});

it('keeps sold-out SKU cards for direct lookup and closing-price calculations', async () => {
  catalog([item('SP014899', 0)]);
  const direct = await ask('SP014899');
  expect(direct?.reply).toBe('SP014899 đã hết hàng.');
  expect(direct?.products?.[0].onHand).toBe(0);
  const price = await ask('SP014899 giá chốt lời 15%');
  expect(price?.reply).toContain('Giá thấp nhất để lời 15% trên vốn: 23.000.000đ.');
  expect(price?.products?.[0].sku).toBe('SP014899');
  expect(price?.products?.[0].onHand).toBe(0);
});
