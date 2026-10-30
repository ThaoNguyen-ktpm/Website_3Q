import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { executeTool } from '../services/assistant/tools.js';
import { catalogStore } from '../services/catalogStore.js';
import * as staff from '../services/staffService.js';
import * as audit from '../services/auditService.js';
import { documentStore } from '../models/documentStore.js';
import { embed } from '../services/documentEmbeddingService.js';
vi.mock('../services/catalogStore.js', () => ({ catalogStore: { products: vi.fn() } }));
vi.mock('../services/staffService.js', () => ({ list: vi.fn() }));
vi.mock('../services/auditService.js', () => ({ list: vi.fn(), actionLabels: { 'auth.login': 'Đăng nhập' } }));
vi.mock('../models/documentStore.js', () => ({ documentStore: { read: vi.fn() } }));
vi.mock('../services/documentEmbeddingService.js', () => ({ embed: vi.fn() }));
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal('fetch', vi.fn(() => { throw Error('Network forbidden'); })); });
afterEach(() => vi.unstubAllGlobals());
it.each([['tim_san_pham', { q: 'x', limit: 5 }], ['hoi_tai_lieu', { question: 'x' }], ['danh_sach_nhan_vien', {}], ['nhat_ky_thao_tac', { limit: 10 }]])('denies %s before accessing data', async (name, args) => {
  const result = await executeTool(name as string, args, []);
  expect(result.content).toContain('Bạn không có quyền xem'); expect(result.sources).toEqual([]);
  for (const fn of [catalogStore.products, staff.list, audit.list, documentStore.read, embed]) expect(fn).not.toHaveBeenCalled();
});
it('projects product fields, hot trend and redacts cost even if upstream returns it', async () => {
  vi.mocked(catalogStore.products).mockResolvedValue({ items: [{ sku: 'SP000094', name: '! Túi', price: 100, onHand: 2, kiot: { categoryName: 'Túi', tradeMarkName: 'LV', inventories: [{ cost: 999 }] }, secret: 'hidden' }], sources: {}, syncedAt: 'today' } as any);
  const args = { q: 'tui', limit: 1 };
  const result = await executeTool('tim_san_pham', args, ['products.view']);
  expect(result.content).toContain('SP000094'); expect(result.content).toContain('"hotTrend":true'); expect(result.content).not.toMatch(/999|secret|hidden|cost/);
  expect(catalogStore.products).toHaveBeenCalledWith({ q: 'tui', page: 1, pageSize: 15 }, false);
  expect((await executeTool('tim_san_pham', args, ['products.view', 'products.cost'])).content).toContain('999');
});

it.each(['sp025211_kg', 'SP025211'])('finds the unique full SKU and its cost from %s', async q => {
  vi.mocked(catalogStore.products).mockResolvedValue({ items: [{ sku: 'SP025211_KG', name: 'Túi', price: 30000000, kiot: { inventories: [{ cost: 20000000 }] } }], sources: {}, syncedAt: 'today' } as any);
  const result = await executeTool('tim_san_pham', { q, limit: 1 }, ['products.view', 'products.cost']);
  expect(result.products?.map(item => item.sku)).toEqual(['SP025211_KG']);
  expect(result.content).toContain('20000000');
  const price = JSON.parse((await executeTool('tinh_gia', { sku: q, cach: 'markup', ty_le: '10' }, ['products.view', 'products.cost'])).content);
  expect(price.product.sku).toBe('SP025211_KG');
  expect(price.sellingPrice).toBe('22000000');
});

it('asks which full SKU to use instead of calculating or selecting an ambiguous base', async () => {
  const codes = ['SP024387_23092026', 'SP024387_KG'];
  vi.mocked(catalogStore.products).mockResolvedValue({ items: codes.map(sku => ({ sku, name: 'Túi', price: 30000000, kiot: { inventories: [{ cost: 20000000 }] } })), sources: {} } as any);
  for (const [name, args] of [['tim_san_pham', { q: 'SP024387', limit: 1 }], ['tinh_gia', { sku: 'SP024387', cach: 'markup', ty_le: '10' }]] as const) {
    const result = await executeTool(name, args, ['products.view', 'products.cost']);
    const data = JSON.parse(result.content);
    expect(data.candidates).toEqual(codes);
    expect(data.message).toContain('chọn');
    expect(data.sellingPrice).toBeUndefined();
    expect(result.products ?? []).toEqual([]);
  }
});

it('prefers an exact base even after many suffixed matches and rejects an unknown suffix', async () => {
  const codes = [...Array.from({ length: 18 }, (_, i) => `SP000009_KG${i}`), 'SP000009'];
  vi.mocked(catalogStore.products).mockResolvedValue({ items: codes.map(sku => ({ sku, name: 'Túi', price: 30000000 })), total: codes.length, sources: {} } as any);
  const exact = await executeTool('tim_san_pham', { q: 'sp000009', limit: 1 }, ['products.view']);
  expect(exact.products?.map(item => item.sku)).toEqual(['SP000009']);
  const missing = await executeTool('tim_san_pham', { q: 'SP000009_OTHER' }, ['products.view']);
  expect(missing.products).toEqual([]);
});
it('retrieves six document chunks with names/pages and no vectors', async () => {
  vi.mocked(documentStore.read).mockResolvedValue([{ name: 'Quy trình.pdf', id: 'doc', chunks: Array.from({ length: 8 }, (_, i) => ({ page: i + 1, text: 'Ký gửi', vector: [1, 0] })) }] as any);
  vi.mocked(embed).mockResolvedValue([1, 0]);
  const result = await executeTool('hoi_tai_lieu', { question: 'Ký gửi?' }, ['documents.view']);
  expect(result.sources).toHaveLength(6); expect(result.sources[0].label).toBe('Quy trình.pdf · trang 1'); expect(result.content).not.toContain('vector');
});
it('returns actual guide, including staff.manage and sample data limits', async () => {
  expect((await executeTool('huong_dan_su_dung', { chu_de: 'Thêm nhân viên' }, [])).content).toContain('staff.manage');
  expect((await executeTool('huong_dan_su_dung', { chu_de: 'Đơn hàng' }, [])).content).toContain('dữ liệu mẫu');
});
it('reports truncation and total staff, filters accents and never exposes internal fields', async () => {
  vi.mocked(staff.list).mockResolvedValue(Array.from({ length: 11 }, (_, i) => ({ fullName: `Bảo ${i}`, email: `test${i}@example.test`, role: 'STAFF', roleLabel: 'Nhân viên', status: 'ACTIVE', lastLoginAt: null, googleSub: 'private' })) as any);
  const result = await executeTool('danh_sach_nhan_vien', { q: 'bao' }, ['staff.view']);
  const data = JSON.parse(result.content);
  expect(data).toMatchObject({ total: 11, truncated: true }); expect(data.items).toHaveLength(10); expect(result.content).not.toContain('private');
});
it('caps escaped tool content while preserving valid JSON and a truncation marker', async () => {
  vi.mocked(staff.list).mockResolvedValue(Array.from({ length: 10 }, () => ({ fullName: '"'.repeat(120), email: 'x'.repeat(191), role: 'STAFF', roleLabel: 'Nhân viên', status: 'ACTIVE', lastLoginAt: null })) as any);
  const result = await executeTool('danh_sach_nhan_vien', {}, ['staff.view']);
  expect(result.content.length).toBeLessThanOrEqual(4000); expect(JSON.parse(result.content).truncated).toBe(true);
});
it.each([['tim_san_pham', { q: 'x', limit: 6 }], ['nhat_ky_thao_tac', { limit: 11 }], ['hoi_tai_lieu', { question: '' }], ['unknown', {}], ['tim_san_pham', { q: 'x', limit: 1, permissions: ['products.cost'] }]])('rejects invalid tool input %s', async (name, args) => {
  expect((await executeTool(name as string, args, ['products.view', 'audit.view'])).content).toContain('không hợp lệ'); expect(catalogStore.products).not.toHaveBeenCalled();
});
