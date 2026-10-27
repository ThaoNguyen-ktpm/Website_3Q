import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { ApiError } from '../middlewares/errorHandler.js';
vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:5173', SESSION_SECRET: 'catalog-test-secret-at-least-32-characters' } }));
const actor = vi.hoisted(() => ({ loggedIn: true, permissions: ['products.view'] as string[] }));
vi.mock('../middlewares/requireAuth.js', () => ({ requireAuth: (_req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!actor.loggedIn) { res.status(401).json({ error: { code: 'UNAUTHENTICATED' } }); return; }
  res.locals.user = { permissions: actor.permissions }; next();
} }));
const store = vi.hoisted(() => ({ products: vi.fn(), forceSync: vi.fn() }));
vi.mock('../services/catalogStore.js', async importOriginal => ({ ...await importOriginal<typeof import('../services/catalogStore.js')>(), catalogStore: store }));
beforeEach(() => { actor.loggedIn = true; actor.permissions = ['products.view']; vi.clearAllMocks(); });
const sync = () => request(app).post('/api/catalog/sync').set('Origin', 'http://localhost:5173');

describe('merged catalog HTTP boundary', () => {
  it('requires authentication and products.view on both endpoints', async () => {
    actor.loggedIn = false;
    expect((await request(app).get('/api/catalog/products')).status).toBe(401); expect((await sync()).status).toBe(401);
    actor.loggedIn = true; actor.permissions = [];
    expect((await request(app).get('/api/catalog/products')).status).toBe(403); expect((await sync()).status).toBe(403);
    expect(store.products).not.toHaveBeenCalled(); expect(store.forceSync).not.toHaveBeenCalled();
  });
  it.each(['?q=a&q=b', '?q=' + 'a'.repeat(201), '?page=0', '?page=1.5', '?pageSize=25', '?pageSize='])('validates before fetching %s', async query => {
    const response = await request(app).get('/api/catalog/products' + query);
    expect(response.status).toBe(400); expect(response.headers['cache-control']).toBe('no-store'); expect(store.products).not.toHaveBeenCalled();
  });
  it('passes defaults and derives cost access from the session, not query parameters', async () => {
    store.products.mockResolvedValue({ items: [], total: 0 });
    const response = await request(app).get('/api/catalog/products?canViewCost=true');
    expect(response.status).toBe(200); expect(response.headers['cache-control']).toBe('no-store');
    expect(store.products).toHaveBeenLastCalledWith({ q: '', page: 1, pageSize: 20 }, false);
    actor.permissions.push('products.cost');
    await request(app).get('/api/catalog/products?q=SKU&page=2&pageSize=15');
    expect(store.products).toHaveBeenLastCalledWith({ q: 'SKU', page: 2, pageSize: 15 }, true);
  });
  it('returns sync state without items and Vietnamese cooldown with wait time', async () => {
    store.forceSync.mockResolvedValue({ total: 2, syncedAt: '2026-01-01', syncing: false, sources: {} });
    const response = await sync(); expect(response.status).toBe(200); expect(response.body).not.toHaveProperty('items');
    expect(response.headers['cache-control']).toBe('no-store');
    store.forceSync.mockRejectedValue(new ApiError(429, 'SYNC_COOLDOWN', 'Vui lòng chờ 59 giây trước khi đồng bộ lại.'));
    const limited = await sync(); expect(limited.status).toBe(429); expect(limited.body.error.message).toContain('59 giây');
  });
  it('enforces existing same-origin protection for manual sync and hides unexpected errors', async () => {
    expect((await request(app).post('/api/catalog/sync').set('Origin', 'https://untrusted.test')).status).toBe(403);
    expect(store.forceSync).not.toHaveBeenCalled();
    store.products.mockRejectedValue(new Error('PRIVATE'));
    const response = await request(app).get('/api/catalog/products');
    expect(response.status).toBe(500); expect(JSON.stringify(response.body)).not.toContain('PRIVATE');
  });
});
