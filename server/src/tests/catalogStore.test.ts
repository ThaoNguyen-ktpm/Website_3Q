import { describe, expect, it, vi } from 'vitest';
import { createCatalogStore, parseProductsQuery } from '../services/catalogStore.js';
import type { CatalogItem, CatalogResult, CatalogSource } from '../services/catalogSearchService.js';

const row = (source: CatalogSource, sku: string, id = 1): CatalogItem => ({ source, productId: id, variantId: source === 'kiotviet' ? null : id, sku, name: 'Túi Chanel Đen', price: source === 'kiotviet' ? 10 : 20, onHand: 2, detail: { images: source === 'kiotviet' ? [] : ['https://image.test/a'], createdDate: '2026-01-01', createdOn: '2026-02-01', inventories: [{ branchId: 1, branchName: 'Kho', onHand: 2, reserved: 0, cost: 8 }] } });
const ok = (source: CatalogSource, items = [row(source, 'SKU')]): CatalogResult => ({ source, status: 'ok', complete: true, items });
const query = (q = '', page = 1, pageSize = 20) => parseProductsQuery({ q, page, pageSize });

describe('merged catalog store', () => {
  it('merges normalized SKU, keeps blank SKUs separate, prioritizes Kiot and sorts newest', async () => {
    const store = createCatalogStore({ fetchAll: async source => ok(source, [row(source, source === 'kiotviet' ? ' sku ' : 'SKU'), row(source, '', 2), row(source, source === 'kiotviet' ? 'kiot-only' : 'sapo-only', 3)]) });
    const result = await store.products(query(), true);
    expect(result.total).toBe(5);
    const merged = result.items.find(item => item.sources.length === 2)!;
    expect(merged.price).toBe(10); expect(merged.name).toBe('Túi Chanel Đen'); expect(merged.image).toBe('https://image.test/a');
    expect(merged.createdAt).toBe('2026-01-01'); expect(merged.kiot?.inventories?.[0].cost).toBe(8);
    expect(result.items[0].createdAt).toBe('2026-02-01');
    expect(new Set(result.items.map(item => item.key)).size).toBe(5);
    expect((await store.products(query('tui chanel den'), false)).total).toBe(5);
    expect((await store.products(query('SKU'), false)).total).toBe(1);
  });
  it('removes costs from JSON without mutating cached rows', async () => {
    const item = row('kiotviet', 'SKU');
    const store = createCatalogStore({ fetchAll: async source => ok(source, source === 'kiotviet' ? [item] : []) });
    expect(JSON.stringify(await store.products(query(), false))).not.toContain('"cost"');
    expect((await store.products(query(), true)).items[0].kiot?.inventories?.[0].cost).toBe(8);
    expect(item.detail?.inventories?.[0].cost).toBe(8);
  });
  it('filters before paging, clamps pages and handles empty catalogs', async () => {
    const store = createCatalogStore({ fetchAll: async source => ok(source, source === 'kiotviet' ? Array.from({ length: 31 }, (_, i) => row(source, `SKU${i}`, i)) : []) });
    const last = await store.products(query('', 99, 15), false);
    expect(last.page).toBe(3); expect(last.pageCount).toBe(3); expect(last.items).toHaveLength(1);
    expect((await store.products(query('missing', 99), false))).toMatchObject({ page: 1, pageCount: 1, total: 0, items: [] });
  });
  it('shares first refresh, returns stale data during background refresh, preserves failed source', async () => {
    let time = 0;
    const pending: { source: CatalogSource; resolve: (result: CatalogResult) => void }[] = [];
    const fetchAll = vi.fn((source: CatalogSource) => new Promise<CatalogResult>(resolve => pending.push({ source, resolve })));
    const store = createCatalogStore({ fetchAll, now: () => time });
    const a = store.products(query(), false), b = store.products(query(), false);
    expect(fetchAll).toHaveBeenCalledTimes(2);
    pending.splice(0).forEach(({ source, resolve }) => resolve(ok(source, [row(source, source)])));
    expect((await a).total).toBe(2); expect((await b).total).toBe(2);
    time = 600001;
    const stale = await store.products(query(), false);
    expect(stale.syncing).toBe(true); expect(stale.total).toBe(2); expect(fetchAll).toHaveBeenCalledTimes(4);
    const joined = store.sync();
    pending.splice(0).forEach(({ source, resolve }) => resolve(source === 'kiotviet' ? { source, status: 'error', items: [], message: 'PRIVATE' } : ok(source, [row(source, 'new')])));
    await joined;
    const updated = await store.products(query(), false);
    expect(updated.items.some(item => item.sku === 'kiotviet')).toBe(true); expect(updated.items.some(item => item.sku === 'new')).toBe(true);
    expect(updated.sources.kiotviet.status).toBe('error'); expect(JSON.stringify(updated)).not.toContain('PRIVATE');
  });
  it('keeps previous complete source on safety cap and isolates thrown errors', async () => {
    let round = 0;
    const store = createCatalogStore({ fetchAll: async source => {
      if (!round) return ok(source);
      if (source === 'kiotviet') throw new Error('PRIVATE');
      return { ...ok(source, [row(source, 'partial')]), complete: false };
    } });
    await store.products(query(), false); round++;
    await store.sync();
    const data = await store.products(query(), false);
    expect(data.total).toBe(1); expect(data.items[0].sku).toBe('SKU');
    expect(data.sources['sapo-web'].status).toBe('error'); expect(JSON.stringify(data)).not.toContain('PRIVATE');
  });
  it('cooldown covers concurrent manual syncs and allows exactly 60 seconds', async () => {
    let time = 0;
    const fetchAll = vi.fn(async (source: CatalogSource) => ok(source));
    const store = createCatalogStore({ fetchAll, now: () => time });
    const first = store.forceSync();
    await expect(store.forceSync()).rejects.toMatchObject({ statusCode: 429 });
    expect(await first).not.toHaveProperty('items');
    time = 59999; await expect(store.forceSync()).rejects.toMatchObject({ statusCode: 429 });
    time = 60000; await store.forceSync(); expect(fetchAll).toHaveBeenCalledTimes(4);
  });
  it.each([{ q: 'x'.repeat(201) }, { q: ['a'] }, { page: '0' }, { page: '1.5' }, { page: '9007199254740992' }, { pageSize: '25' }, { pageSize: '' }])('validates query %j', input => {
    expect(() => parseProductsQuery(input)).toThrow();
  });
  it('accepts empty queries, defaults and all five page sizes', () => {
    expect(parseProductsQuery({})).toEqual({ q: '', page: 1, pageSize: 20 });
    for (const size of [15, 20, 30, 50, 100]) expect(parseProductsQuery({ pageSize: String(size) }).pageSize).toBe(size);
  });
  it('keeps successful timestamp when both providers fail', async () => {
    let time = 0, fail = false;
    const store = createCatalogStore({ now: () => time, fetchAll: async source => {
      if (fail) throw new Error('PRIVATE');
      return ok(source);
    } });
    const initial = await store.products(query(), false);
    time = 60000; fail = true; await store.sync();
    expect((await store.products(query(), false)).syncedAt).toBe(initial.syncedAt);
  });
  it('serves the saved snapshot at once, refreshes in the background and saves the new catalog', async () => {
    let finish!: () => void;
    const fetchAll = vi.fn(() => new Promise<CatalogResult>(resolve => { finish = () => resolve(ok('kiotviet', [row('kiotviet', 'NEW')])); }));
    const save = vi.fn();
    const store = createCatalogStore({ sources: ['kiotviet'], fetchAll, now: () => 700000, snapshot: {
      load: () => ({ rows: { kiotviet: [row('kiotviet', 'OLD')] }, complete: ['kiotviet'], syncedAt: '2026-10-19T00:00:00.000Z' }), save } });
    const first = await store.products(query(), false);
    expect(first.items.map(item => item.sku)).toEqual(['OLD']);
    expect(first.syncedAt).toBe('2026-10-19T00:00:00.000Z');
    expect(first.syncing).toBe(true);
    finish(); await store.sync();
    expect((await store.products(query(), false)).items.map(item => item.sku)).toEqual(['NEW']);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ complete: ['kiotviet'], rows: expect.objectContaining({ kiotviet: [expect.objectContaining({ sku: 'NEW' })] }) }));
  });
  it('ignores a broken or incomplete snapshot and syncs normally', async () => {
    for (const load of [() => { throw new Error('bad json'); }, () => ({ rows: { kiotviet: [row('kiotviet', 'OLD')] }, complete: [], syncedAt: null })]) {
      const store = createCatalogStore({ sources: ['kiotviet'], fetchAll: async source => ok(source, [row(source, 'NEW')]), snapshot: { load: load as never, save: () => {} } });
      expect((await store.products(query(), false)).items.map(item => item.sku)).toEqual(['NEW']);
    }
  });
});
