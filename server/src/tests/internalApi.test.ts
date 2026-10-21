import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { quickAnswer } from '../services/assistant/graph.js';
import { catalogStore } from '../services/catalogStore.js';

const token = 'x'.repeat(40);
vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:5173', INTERNAL_TOKEN: 'x'.repeat(40) } }));
vi.mock('../models/staffModel.js', () => ({ findByEmail: vi.fn(async (email: string) => email === 'admin@example.test' ? { role: 'ADMIN', status: 'ACTIVE', customPermissions: false, permissions: [] } : null) }));
vi.mock('../models/rolePermissionModel.js', () => ({ list: vi.fn(async () => []) }));
vi.mock('../services/assistant/graph.js', () => ({ quickAnswer: vi.fn(), chat: vi.fn() }));
vi.mock('../services/catalogStore.js', () => ({ catalogStore: { sync: vi.fn(), rawRows: vi.fn() } }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(quickAnswer).mockResolvedValue({ reply: 'Có 1 sản phẩm phù hợp:', offTopic: false, sources: [], products: [] }); });
const body = { messages: [{ role: 'user', content: 'túi Chanel' }] };

it('answers the local bot with the shared token and admin product permissions', async () => {
  const result = await request(app).post('/internal/assistant').set('X-Internal-Token', token).send(body);
  expect(result.status).toBe(200);
  expect(result.headers['cache-control']).toBe('no-store');
  expect(result.body.answer.reply).toBe('Có 1 sản phẩm phù hợp:');
  expect(quickAnswer).toHaveBeenCalledWith(body, ['products.view', 'products.cost']);
});

it('answers staff on the bot without cost (Bảo 2026-10-20)', async () => {
  await request(app).post('/internal/assistant').set('X-Internal-Token', token).set('X-Bosstele-Staff', '1').send(body);
  expect(quickAnswer).toHaveBeenCalledWith(body, ['products.view']);
});

it('hides the route without the right token', async () => {
  for (const given of [undefined, 'wrong', token.slice(1) + 'y']) {
    const call = request(app).post('/internal/assistant');
    const result = await (given === undefined ? call : call.set('X-Internal-Token', given)).send(body);
    expect(result.status).toBe(404);
  }
  expect(quickAnswer).not.toHaveBeenCalled();
});

it('returns null when code cannot answer so the bot can ask Claude', async () => {
  vi.mocked(quickAnswer).mockResolvedValue(null);
  const result = await request(app).post('/internal/assistant').set('X-Internal-Token', token).send(body);
  expect(result.body).toEqual({ answer: null });
});

it('syncs the catalog once for Sale AI and returns the raw Kiot rows', async () => {
  vi.mocked(catalogStore.rawRows).mockReturnValue({ rows: [{ productId: 1 }] as any, complete: true, syncedAt: 'now', status: 'ok', message: undefined });
  const result = await request(app).post('/internal/catalog/sync').set('X-Internal-Token', token);
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ rows: [{ productId: 1 }], complete: true, syncedAt: 'now', status: 'ok' });
  expect(catalogStore.sync).toHaveBeenCalledTimes(1);
  expect(catalogStore.rawRows).toHaveBeenCalledWith('kiotviet');
});

it('reports a failed or incomplete sync instead of handing Sale AI partial data', async () => {
  vi.mocked(catalogStore.rawRows).mockReturnValue({ rows: [] as any, complete: false, syncedAt: null, status: 'error', message: 'Không đồng bộ được nguồn.' });
  const result = await request(app).post('/internal/catalog/sync').set('X-Internal-Token', token);
  expect([result.status, result.body.error.code]).toEqual([502, 'CATALOG_SYNC_FAILED']);
  expect((await request(app).post('/internal/catalog/sync')).status).toBe(404);
});

it('tells BossTele the website permissions of a linked staff email (Bảo 2026-10-20)', async () => {
  const admin = await request(app).post('/internal/staff-permissions').set('X-Internal-Token', token).send({ email: ' Admin@Example.test ' });
  expect(admin.body.permissions).toContain('products.cost');
  const unknown = await request(app).post('/internal/staff-permissions').set('X-Internal-Token', token).send({ email: 'x@example.test' });
  expect(unknown.body).toEqual({ role: null, permissions: null });
  expect((await request(app).post('/internal/staff-permissions').send({ email: 'admin@example.test' })).status).toBe(404);
});
