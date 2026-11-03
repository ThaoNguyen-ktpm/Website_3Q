import request from 'supertest';
import { readFile } from 'node:fs/promises';
import { beforeEach, expect, it, vi } from 'vitest';
import { app } from '../app.js';

vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:8787' } }));
vi.mock('../sale-ai/runtime.js', () => ({ getSaleAi: vi.fn() }));
vi.mock('node:fs/promises', async importOriginal => ({
  ...await importOriginal<typeof import('node:fs/promises')>(), readFile: vi.fn(),
}));
vi.mock('../middlewares/requireAuth.js', () => ({ requireAuth: (req: any, res: any, next: any) => {
  const role = req.get('X-Test-Role');
  if (!role) return res.status(401).json({ error: { message: 'Chưa đăng nhập' } });
  res.locals.user = { id: 1, role, permissions: ['dashboard.view', 'sale.manage'] };
  next();
} }));
const page = '/v2/mockup/baoq-mockup-v2.html';
const snapshot = '/v2/mockup/kpi/snapshot.json';
const admin = (path: string) => request(app).get(path).set('X-Test-Role', 'ADMIN');
beforeEach(() => vi.mocked(readFile).mockReset());

it('protects every V2 asset and snapshot with login and ADMIN, even when other roles have permissions', async () => {
  for (const path of [page, snapshot, '/v2/mockup/kpi/controller.mjs', '/v2/mockup/goods/data.js', '/v2/missing']) {
    expect((await request(app).get(path)).status).toBe(401);
    for (const role of ['STAFF', 'MANAGER']) {
      expect((await request(app).get(path).set('X-Test-Role', role)).status).toBe(403);
    }
  }
  expect(readFile).not.toHaveBeenCalled();
});

it('serves the page, modules and CSS to Admin with a CSP that permits the local V2 runtime', async () => {
  const response = await admin(page);
  expect(response.status).toBe(200);
  expect(response.text).toContain('BAOQ');
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-security-policy']).toContain("script-src 'self' 'unsafe-inline'");
  expect(response.headers['content-security-policy']).toContain("connect-src 'self'");
  for (const path of ['kpi/controller.mjs', 'kpi/model.mjs', 'kpi/income.mjs', 'kpi/view.mjs', 'kpi/style.css', 'goods/app.js', 'goods/engine.js', 'goods/data.js', 'goods/app-ops.scoped.css']) {
    const asset = await admin('/v2/mockup/' + path);
    expect(asset.status).toBe(200);
    expect(asset.headers['content-type']).toMatch(path.endsWith('.css') ? /css/ : /javascript/);
  }
});

it('allows embedding only in the same origin, retaining Admin protection', async () => {
  const response = await admin(page + '?embed=1');
  expect(response.status).toBe(200);
  expect(response.headers['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(response.headers['x-frame-options']).toBe('SAMEORIGIN');
  expect((await request(app).get(page + '?embed=1')).status).toBe(401);
  expect((await request(app).get(page + '?embed=1').set('X-Test-Role', 'STAFF')).status).toBe(403);
});

it('returns only the fixed private snapshot as JSON without caching', async () => {
  vi.mocked(readFile).mockResolvedValue(Buffer.from('{"version":"test-fixture","orders":[]}'));
  const response = await admin(snapshot + '?v=1');
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ version: 'test-fixture', orders: [] });
  expect(response.headers['cache-control']).toBe('no-store');
  expect(response.headers['content-type']).toMatch(/application\/json/);
  expect(String(vi.mocked(readFile).mock.calls[0][0])).toMatch(/\/data\/v2\/kpi-snapshot\.json$/);
});

it('returns 404 for a missing snapshot and handles other disk errors without disclosing paths', async () => {
  vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('private disk path'), { code: 'ENOENT' }));
  expect((await admin(snapshot)).status).toBe(404);
  vi.mocked(readFile).mockRejectedValueOnce(Object.assign(new Error('private disk path'), { code: 'EACCES' }));
  const response = await admin(snapshot);
  expect(response.status).toBe(500);
  expect(response.text).not.toContain('private disk path');
});

it('does not expose data folders, README or files outside the static root', async () => {
  for (const path of ['/v2/README.md', '/v2/data/v2/kpi-snapshot.json', '/v2/mockup/%2e%2e/%2e%2e/data/v2/kpi-snapshot.json', '/v2/mockup/..%2f..%2fdata/v2/kpi-snapshot.json', '/v2/mockup/%2e%2e%5c%2e%2e%5cdata/v2/kpi-snapshot.json']) {
    expect((await admin(path)).status).toBe(404);
  }
  expect(readFile).not.toHaveBeenCalled();
});
