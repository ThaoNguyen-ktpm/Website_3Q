// TASK-104 replaces the proxy: exercise the embedded core behind the existing guards.
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { getSaleAi } from '../sale-ai/runtime.js';
import { createSaleAi } from '../sale-ai/core.js';
vi.mock('../sale-ai/runtime.js', () => ({ getSaleAi: vi.fn() }));
vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:8787' } }));
vi.mock('../middlewares/requireAuth.js', () => ({ requireAuth: (req: any, res: any, next: any) => {
 if (!req.get('X-Test-User')) return res.status(401).json({ error: { message: 'B?n ch?a ??ng nh?p.' } });
 res.locals.user = { id: 1, permissions: (req.get('X-Test-Permissions') ?? '').split(',').filter(Boolean) }; next();
} }));
const sale = (path: string, permissions = 'sale.manage') => request(app).get(path).set('X-Test-User', '1').set('X-Test-Permissions', permissions);
beforeEach(() => vi.mocked(getSaleAi).mockReturnValue(undefined));
it('needs login and sale.manage for API and static pages', async () => {
 for (const path of ['/sale-ai/api/state', '/sale-ai/']) {
  expect((await request(app).get(path)).status).toBe(401);
  expect((await sale(path, 'products.view')).status).toBe(403);
 }
});
it('redirects to the trailing slash and reports startup as 503', async () => {
 const redirect = await sale('/sale-ai');
 expect([redirect.status, redirect.headers.location]).toEqual([301, '/sale-ai/']);
 const down = await sale('/sale-ai/api/status');
 expect(down.status).toBe(503);
 expect(down.body.error).toContain('đang khởi động');
 const page = await sale('/sale-ai/').set('Accept', 'text/html');
 expect(page.status).toBe(503);
 expect(page.text).toContain('http-equiv="refresh"');
 expect(page.headers['content-security-policy']).toContain("frame-ancestors 'self'");
});
it('rejects cross-site mutation before reaching the core', async () => {
 const handler = vi.fn();
 vi.mocked(getSaleAi).mockReturnValue({handler} as unknown as NonNullable<ReturnType<typeof getSaleAi>>);
 for (const path of ['/sale-ai/api/kiot/commit', '/sale-ai/api/run', '/sale-ai/api/manual-price']) {
  expect((await request(app).post(path).set('X-Test-User','1').set('X-Test-Permissions','sale.manage').set('Origin','https://evil.test').send({confirmed:true})).status).toBe(403);
 }
 expect(handler).not.toHaveBeenCalled();
});
it('only a logged-in sale manager reaches the real embedded core; a token header cannot bypass website guards', async () => {
 const memory = () => { let value: unknown = null; return {read: async () => structuredClone(value), write: async (next: unknown) => { value = structuredClone(next); }}; };
 const forbidden = async () => { throw Error('Unexpected external call'); };
 const core = await createSaleAi({fixture:true,store:memory(),liveStore:memory(),sapoStore:memory(),client:{all:forbidden},sapoClient:{configured:false,all:forbidden}});
 vi.mocked(getSaleAi).mockReturnValue(core);
 const path = '/sale-ai/api/status';
 expect((await request(app).get(path)).status).toBe(401);
 expect((await request(app).get(path).set('x-sale-ai-token','t'.repeat(64))).status).toBe(401);
 expect((await sale(path,'products.view')).status).toBe(403);
 const response = await sale(path);
 expect(response.status).toBe(200);
 expect(response.body.busy).toBe(false);
});
