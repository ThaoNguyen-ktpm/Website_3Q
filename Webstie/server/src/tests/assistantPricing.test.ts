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

it('ignores assistant example SKUs when the user has not supplied one', async () => {
  const result = await pricingAnswer([{ role: 'assistant', content: 'ví dụ SP014899' }, { role: 'user', content: 'xem giá vốn' }], all);
  expect(result?.reply).toContain('Bạn cho mình SKU');
  expect(executeTool).not.toHaveBeenCalled();
});

it.each(['SP025211_KG', 'sp025211'])('prices the full code resolved from %s', async sku => {
  const item = { ...product, sku: 'SP025211_KG' };
  vi.mocked(executeTool).mockResolvedValue({ content: JSON.stringify({ items: [{ sku: item.sku, cost: [{ cost: 20000000 }] }] }), sources: [], products: [item] });
  const result = await pricingAnswer([{ role: 'user', content: `xem giá vốn ${sku}` }], all);
  expect(result?.products).toEqual([item]);
  expect(result?.reply).toBe('SP025211_KG: vốn 20.000.000đ · đang bán 26.000.000đ · lời 6.000.000đ (30%)');
  expect(executeTool).toHaveBeenCalledWith('tim_san_pham', { q: sku.toUpperCase(), limit: 1 }, all);
});

it.each(['giá vốn', 'XEM VỐN', 'von bao nhieu', 'vốn của', 'nhập giá bao nhiêu'])('looks up cost for %s', async text => {
  vi.mocked(executeTool).mockResolvedValue(found(20000000));
  const result = await pricingAnswer([{ role: 'user', content: `${text} SP014899` }], all);
  expect(result?.reply).toBe('SP014899: vốn 20.000.000đ · đang bán 26.000.000đ · lời 6.000.000đ (30%)');
  expect(result?.products).toEqual([product]);
  expect(executeTool).toHaveBeenCalledTimes(1);
});

it('denies cost access and keeps the sale price and card without leaking cost', async () => {
  vi.mocked(executeTool).mockResolvedValue(found(20000000));
  const result = await pricingAnswer([{ role: 'user', content: 'xem giá vốn SP014899' }], ['products.view']);
  expect(result?.reply).toBe('Bạn không có quyền xem giá vốn. Giá bán hiện tại 26.000.000đ.');
  expect(result?.products).toEqual([product]);
  expect(JSON.stringify(result)).not.toContain('20.000.000');
  expect(JSON.stringify(result)).not.toContain('20000000');
});

it('reports missing cost and keeps the sale price', async () => {
  vi.mocked(executeTool).mockResolvedValue(found(null));
  const result = await pricingAnswer([{ role: 'user', content: 'xem giá vốn SP014899' }], all);
  expect(result?.reply).toBe('SP014899 chưa có giá vốn trên KiotViet. Giá bán hiện tại 26.000.000đ.');
  expect(result?.products).toEqual([product]);
});

it('uses the highest differing branch cost and lists the values', async () => {
  vi.mocked(executeTool).mockResolvedValue({ ...found(20000000), content: JSON.stringify({ items: [{ sku: product.sku,
    cost: [{ cost: 18000000 }, { cost: 20000000 }, { cost: null }, { cost: 18000000 }] }] }) });
  expect((await pricingAnswer([{ role: 'user', content: 'xem vốn SP014899' }], all))?.reply)
    .toBe('SP014899: vốn 20.000.000đ (chi nhánh khác nhau: 18.000.000đ, 20.000.000đ) · đang bán 26.000.000đ · lời 6.000.000đ (30%)');
});

it.each([null, 0])('shows only cost when the sale price is %s', async price => {
  vi.mocked(executeTool).mockResolvedValue({ ...found(20000000), products: [{ ...product, price }] });
  expect((await pricingAnswer([{ role: 'user', content: 'xem vốn SP014899' }], all))?.reply).toBe('SP014899: vốn 20.000.000đ');
});

it('leaves the explicit BossTele calculator command to its existing handler', async () => {
  expect(await pricingAnswer([{ role: 'user', content: 'SP014899' },
    { role: 'user', content: 'tính giá vốn=20000000 chi_phí=0 cách=markup tỷ_lệ=30' }], all)).toBeNull();
  expect(executeTool).not.toHaveBeenCalled();
});

it('formats a loss and a fractional percentage using the existing formatters', async () => {
  vi.mocked(executeTool).mockResolvedValue(found(30000000));
  expect((await pricingAnswer([{ role: 'user', content: 'xem vốn SP014899' }], all))?.reply)
    .toBe('SP014899: vốn 30.000.000đ · đang bán 26.000.000đ · lời -4.000.000đ (-13,3%)');
});

it.each(['SP025211_KG giá chốt', 'xem giá vốn SP025211_KG và giá chốt'])('keeps closing-price behavior for %s', async text => {
  const item = { ...product, sku: 'SP025211_KG' };
  vi.mocked(executeTool).mockResolvedValue({ ...found(20000000), content: JSON.stringify({ items: [{ sku: item.sku, cost: [{ cost: 20000000 }] }] }), products: [item] });
  const result = await pricingAnswer([{ role: 'user', content: text }], all);
  expect(result?.reply).toBe('Chưa đề ra giá chốt.');
  expect(result?.suggestions?.[0]).toBe('SP025211_KG giá chốt lời 10%');
});

it('returns the full SKU choices instead of pricing an ambiguous base', async () => {
  const message = 'Có nhiều sản phẩm cùng mã gốc. Bạn chọn mã nào: SP024387_23092026, SP024387_KG?';
  vi.mocked(executeTool).mockResolvedValue({ content: JSON.stringify({ message, candidates: ['SP024387_23092026', 'SP024387_KG'] }), sources: [] });
  const result = await pricingAnswer([{ role: 'user', content: 'SP024387 giá chốt lời 10%' }], all);
  expect(result?.reply).toBe(message);
  expect(result?.products ?? []).toEqual([]);
  expect(executeTool).toHaveBeenCalledTimes(1);
});
