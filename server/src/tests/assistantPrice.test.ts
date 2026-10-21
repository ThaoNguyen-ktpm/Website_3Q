import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { executeTool } from '../services/assistant/tools.js';
import { catalogStore } from '../services/catalogStore.js';
import * as audit from '../services/auditService.js';
vi.mock('../services/catalogStore.js', () => ({ catalogStore: { products: vi.fn() } }));
vi.mock('../services/staffService.js', () => ({ list: vi.fn() }));
vi.mock('../services/auditService.js', () => ({ list: vi.fn(), actionLabels: { 'auth.login': 'Đăng nhập' } }));
vi.mock('../models/documentStore.js', () => ({ documentStore: { read: vi.fn() } }));
vi.mock('../services/documentEmbeddingService.js', () => ({ embed: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', vi.fn(() => { throw Error('Network forbidden'); })); });
afterEach(() => vi.unstubAllGlobals());
const product = (costs: (number | null)[]) => ({ items: [{ sku: 'SP000094', name: 'Soft Trunk', price: 35000000, kiot: { inventories: costs.map((cost, i) => ({ branchName: `CN${i}`, cost })) } }] });

it('calculates markup and margin with the exact BossTele formula from a given cost', async () => {
  const markup = JSON.parse((await executeTool('tinh_gia', { von: 31000000, chi_phi: null, cach: 'markup', ty_le: 15 }, [])).content);
  expect(markup).toMatchObject({ cost: '31000000', sellingPrice: '35650000', method: 'markup', rate: '15' });
  const margin = JSON.parse((await executeTool('tinh_gia', { von: '100', chi_phi: '0', cach: 'margin', ty_le: '33.3' }, [])).content);
  expect(margin.sellingPrice).toBe('150'); // 100 / 0.667 = 149.93 → rounded up
  expect(catalogStore.products).not.toHaveBeenCalled();
});
it('reads KiotViet cost by SKU only with products.cost and uses the highest branch cost', async () => {
  vi.mocked(catalogStore.products).mockResolvedValue(product([30000000, 31000000, null]) as any);
  const result = await executeTool('tinh_gia', { sku: 'sp000094', cach: 'markup', ty_le: 10 }, ['products.view', 'products.cost']);
  const data = JSON.parse(result.content);
  expect(data).toMatchObject({ cost: '31000000', sellingPrice: '34100000', product: { sku: 'SP000094' } });
  expect(data.note).toContain('giá cao nhất');
  expect(result.sources[0]).toEqual({ kind: 'price', label: 'Tính giá · SP000094 · markup 10%' });
});
it('refuses to read cost by SKU without products.cost', async () => {
  const result = await executeTool('tinh_gia', { sku: 'SP000094', cach: 'markup', ty_le: 10 }, ['products.view']);
  expect(result.content).toContain('không có quyền xem giá vốn');
  expect(catalogStore.products).not.toHaveBeenCalled();
});
it.each([
  [{ cach: 'markup', ty_le: 10 }],
  [{ von: -1, cach: 'markup', ty_le: 10 }],
  [{ von: 100, cach: 'discount', ty_le: 10 }],
  [{ von: 100, cach: 'markup', ty_le: '1e3' }],
])('rejects invalid price input %j', async args => {
  expect((await executeTool('tinh_gia', args, [])).content).toContain('không hợp lệ');
});
it('reports margin >= 100% from the calculator', async () => {
  expect((await executeTool('tinh_gia', { von: 100, cach: 'margin', ty_le: 100 }, [])).content).toContain('Margin phải dưới 100%');
});
it('shows audit times in Vietnam time, not UTC', async () => {
  vi.mocked(audit.list).mockResolvedValue({ items: [{ createdAt: new Date('2026-10-17T07:35:10.988Z'), actorEmail: 'a@test', actionLabel: 'Đăng nhập' }] } as any);
  const result = await executeTool('nhat_ky_thao_tac', { limit: 1 }, ['audit.view']);
  expect(result.content).toContain('14:35:10');
  expect(result.content).not.toContain('07:35');
});
