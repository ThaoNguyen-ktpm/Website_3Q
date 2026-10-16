import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCatalogSearch, parseCatalogQuery } from '../services/catalogSearchService.js';
import { app } from '../app.js';
import { rolePermissions } from '../config/permissions.js';

vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 'catalog-test-secret-at-least-32-characters' } }));
const actor = vi.hoisted(() => ({ permissions: ['products.view'] as string[], loggedIn: true }));
vi.mock('../middlewares/requireAuth.js', () => ({ requireAuth: (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!actor.loggedIn) { res.status(401).json({ error: { code: 'UNAUTHENTICATED' } }); return; }
  res.locals.user = { permissions: actor.permissions }; next();
} }));
const librarySearch = vi.hoisted(() => vi.fn());
vi.mock('../services/catalogSearchService.js', async importOriginal => {
  const original = await importOriginal<typeof import('../services/catalogSearchService.js')>();
  return { ...original, searchCatalog: (...args: unknown[]) => librarySearch(...args) };
});
beforeEach(() => { actor.loggedIn = true; actor.permissions = ['products.view']; librarySearch.mockReset(); });

describe('catalog boundary', () => {
  it('requires login and products.view before searching', async () => {
    actor.loggedIn = false;
    expect((await request(app).get('/api/catalog/search?q=Chanel')).status).toBe(401);
    actor.loggedIn = true; actor.permissions = [];
    expect((await request(app).get('/api/catalog/search?q=Chanel')).status).toBe(403);
    expect(librarySearch).not.toHaveBeenCalled();
  });
  it.each(['', '?q=', '?q=a&kind=bad', '?q=a&source=sapo-pos', '?q=a&page=0', '?q=a&page=1.5', '?q=a&page=', '?q=a&q=b', `?q=${'a'.repeat(201)}`])('rejects invalid query %s', async query => {
    const response = await request(app).get(`/api/catalog/search${query}`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(librarySearch).not.toHaveBeenCalled();
  });
  it('trims query and derives cost permission from authenticated user', async () => {
    librarySearch.mockResolvedValue({ results: [], canViewCost: false });
    expect((await request(app).get('/api/catalog/search?q=%20Chanel%20')).status).toBe(200);
    expect(librarySearch).toHaveBeenLastCalledWith({ q: 'Chanel', kind: 'name', source: 'all', page: 1 }, false);
    actor.permissions.push('products.cost');
    await request(app).get('/api/catalog/search?q=SKU&kind=sku');
    expect(librarySearch).toHaveBeenLastCalledWith({ q: 'SKU', kind: 'sku', source: 'all', page: 1 }, true);
  });
});

describe('catalog service', () => {
  const query = { q: 'Chanel', kind: 'name' as const, source: 'all' as const, page: 1 };
  const item = { source: 'kiotviet' as const, productId: 1, variantId: null, name: 'Chanel', sku: 'SKU', price: 10, onHand: 2, detail: { inventories: [{ branchId: 1, branchName: 'Kho', onHand: 2, reserved: 0, cost: 5 }] } };
  it('requests only two sources with detail, removes cost without mutating library rows', async () => {
    const search = vi.fn(async ({ source }) => [{ source, status: 'ok' as const, items: [item] }]);
    const createSearch = vi.fn(() => search);
    const service = createCatalogSearch({ loadConfig: () => ({}), createSearch });
    const hidden = await service(query, false);
    expect(hidden.canViewCost).toBe(false);
    expect(JSON.stringify(hidden)).not.toContain('"cost"');
    expect(item.detail.inventories[0].cost).toBe(5);
    expect(search.mock.calls.map(([options]) => options.source)).toEqual(['kiotviet', 'sapo-web']);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ detail: true, query: 'Chanel' }));
    const visible = await service(query, true);
    expect(visible.results[0].items[0].detail?.inventories?.[0].cost).toBe(5);
    expect(createSearch).toHaveBeenCalledTimes(1);
  });
  it('isolates configuration and unexpected provider errors without exposing secrets', async () => {
    const badConfig = createCatalogSearch({ loadConfig: () => { throw new Error('SECRET'); }, createSearch: vi.fn() });
    const failed = await badConfig(query, false);
    expect(failed.results.map(result => result.status)).toEqual(['error', 'error']);
    expect(JSON.stringify(failed)).not.toContain('SECRET');
    const partial = createCatalogSearch({ loadConfig: () => ({}), createSearch: () => async ({ source }) => {
      if (source === 'kiotviet') throw new Error('SECRET');
      return [{ source, status: 'ok', items: [] }];
    } });
    expect((await partial(query, false)).results.map(result => result.status)).toEqual(['error', 'ok']);
  });
  it('retains a missing-key source error and the other source rows', async () => {
    const service = createCatalogSearch({ loadConfig: () => ({}), createSearch: () => async ({ source }) => [source === 'kiotviet'
      ? { source, status: 'error', items: [], code: 'missing_config', message: 'Chưa điền cấu hình.' }
      : { source, status: 'ok', items: [{ ...item, source }] }] });
    const result = await service(query, false);
    expect(result.results[0].code).toBe('missing_config');
    expect(result.results[1].items).toHaveLength(1);
  });
  it('continues Sapo SKU scan from page rather than rescanning', async () => {
    const search = vi.fn(async ({ source }) => [{ source, status: 'ok' as const, items: [], nextPage: 41, hasMore: true, warning: 'Chưa quét hết' }]);
    const service = createCatalogSearch({ loadConfig: () => ({}), createSearch: () => search });
    const result = await service({ ...query, source: 'sapo-web', kind: 'sku', page: 21 }, false);
    expect(search).toHaveBeenCalledWith(expect.objectContaining({ startPage: 21 }));
    expect(result.results[0].nextPage).toBe(41);
    expect(result.results[0].warning).toBe('Chưa quét hết');
  });
  it('cost is not a default manager or staff permission', () => {
    expect(rolePermissions.ADMIN).toContain('products.cost');
    expect(rolePermissions.MANAGER).not.toContain('products.cost');
    expect(rolePermissions.STAFF).not.toContain('products.cost');
    expect(parseCatalogQuery({ q: '  SKU  ', kind: 'sku' }).q).toBe('SKU');
  });
});
