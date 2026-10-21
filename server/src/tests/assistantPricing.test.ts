import { beforeEach, expect, it, vi } from 'vitest';
import { pricingAnswer } from '../services/assistant/pricing.js';
import { executeTool } from '../services/assistant/tools.js';

vi.mock('../services/assistant/tools.js', () => ({ executeTool: vi.fn() }));
const product = { sku: 'SP014899', name: 'Túi Hermes Garden Party', price: 26000000, onHand: 1, hotTrend: false, image: null };
const found = (cost: number | null) => ({
  content: JSON.stringify({ items: [{ sku: 'SP014899', ...(cost === null ? {} : { cost: [{ branch: 'CN', cost }] }) }] }),
  sources: [{ kind: 'product', label: 'SP014899 · Túi' }], products: [product],
});
const all = ['products.view', 'products.cost'] as any;
beforeEach(() => vi.resetAllMocks());

it('says no closing price is set and offers profit-rate buttons', async () => {
  vi.mocked(executeTool).mockResolvedValue(found(20000000));
  const result = await pricingAnswer([{ role: 'user', content: 'SP014899\n26.000.000đ\nCòn 1 đề xuất giá chốt cho khách' }], all);
  expect(result?.reply).toBe('Chưa đề ra giá chốt.');
  expect(result?.suggestions).toEqual(['SP014899 giá chốt lời 10%', 'SP014899 giá chốt lời 15%', 'SP014899 giá chốt lời 20%']);
  expect(result?.products).toEqual([product]);
});
it('computes the floor price for a chosen profit rate with the BossTele calculator', async () => {
  vi.mocked(executeTool).mockImplementation(async name => name === 'tinh_gia'
    ? { content: JSON.stringify({ sellingPrice: '23000000' }), sources: [] } : found(20000000));
  const result = await pricingAnswer([{ role: 'user', content: 'SP014899 giá chốt lời 15%' }], all);
  expect(executeTool).toHaveBeenCalledWith('tinh_gia', { sku: 'SP014899', cach: 'markup', ty_le: '15' }, all);
  expect(result?.reply).toBe('Giá thấp nhất để lời 15% trên vốn: 23.000.000đ. So với giá bán 26.000.000đ, có thể giảm tối đa 3.000.000đ.');
});
it('warns instead of suggesting a discount when the price is already below the floor', async () => {
  vi.mocked(executeTool).mockImplementation(async name => name === 'tinh_gia'
    ? { content: JSON.stringify({ sellingPrice: '33810000' }), sources: [] } : found(29400000));
  expect((await pricingAnswer([{ role: 'user', content: 'SP014899 lời 15%' }], all))?.reply)
    .toBe('Giá thấp nhất để lời 15% trên vốn: 33.810.000đ. Giá bán hiện tại 26.000.000đ đang thấp hơn mức này 7.810.000đ, không nên giảm thêm.');
});
it('uses the SKU from earlier in the conversation', async () => {
  vi.mocked(executeTool).mockResolvedValue(found(20000000));
  await pricingAnswer([{ role: 'user', content: 'SP014899' }, { role: 'assistant', content: 'Có 1 sản phẩm SP014899 phù hợp:' }, { role: 'user', content: 'giá chốt bao nhiêu' }], all);
  expect(executeTool).toHaveBeenCalledWith('tim_san_pham', { q: 'SP014899', limit: 1 }, all);
});
it('does not reveal cost or compute a floor without products.cost', async () => {
  vi.mocked(executeTool).mockResolvedValue(found(null));
  const result = await pricingAnswer([{ role: 'user', content: 'SP014899 giá chốt' }], ['products.view'] as any);
  expect(result?.reply).toBe('Giá bán hiện tại 26.000.000đ. Bạn không có quyền xem giá vốn nên mình không tính được mức giá chốt.');
});
it('asks for a SKU when none is known and ignores non-pricing questions', async () => {
  expect((await pricingAnswer([{ role: 'user', content: 'giá chốt bao nhiêu' }], all))?.reply).toContain('SKU');
  expect(await pricingAnswer([{ role: 'user', content: 'túi Chanel' }], all)).toBeNull();
  expect(executeTool).not.toHaveBeenCalled();
});
