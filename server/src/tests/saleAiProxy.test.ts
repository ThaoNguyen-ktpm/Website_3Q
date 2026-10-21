import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { app } from '../app.js';
import { env } from '../config/env.js';

vi.mock('../config/env.js', () => ({ env: { APP_ORIGIN: 'http://localhost:5173', SALE_AI_URL: 'http://127.0.0.1:1' } }));
vi.mock('../middlewares/requireAuth.js', () => ({ requireAuth: (req: any, res: any, next: any) => {
  if (!req.get('X-Test-User')) return res.status(401).json({ error: { message: 'Bạn chưa đăng nhập.' } });
  res.locals.user = { id: 1, permissions: (req.get('X-Test-Permissions') ?? '').split(',').filter(Boolean) }; next();
} }));

// A stand-in Sale AI that echoes what it received.
let seen: { method?: string; url?: string; cookie?: string; host?: string; origin?: string; body: string }[] = [];
const upstream = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => { body += chunk; }).on('end', () => {
    seen.push({ method: req.method, url: req.url, cookie: req.headers.cookie, host: req.headers.host, ...(req.headers.origin ? { origin: req.headers.origin } : {}), body });
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Security-Policy': "frame-ancestors http://localhost:5173" });
    res.end(JSON.stringify({ ok: true }));
  });
});
beforeAll(async () => {
  await new Promise<void>(resolve => upstream.listen(0, '127.0.0.1', resolve));
  env.SALE_AI_URL = `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>(resolve => upstream.close(() => resolve())));
beforeEach(() => { seen = []; });
const sale = (path: string, permissions = 'sale.manage') => request(app).get(path).set('X-Test-User', '1').set('X-Test-Permissions', permissions);

it('needs login and sale.manage before reaching Sale AI', async () => {
  expect((await request(app).get('/sale-ai/api/status')).status).toBe(401);
  expect((await sale('/sale-ai/api/status', 'products.view')).status).toBe(403);
  expect(seen).toEqual([]);
});

it('forwards GET requests on the website port without the website session cookie', async () => {
  const result = await sale('/sale-ai/api/view?view=history&dataset=real').set('Cookie', 'session=secret').set('Host', 'localhost:5173');
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ ok: true });
  expect(result.headers['content-security-policy']).toBe('frame-ancestors http://localhost:5173');
  expect(seen).toEqual([{ method: 'GET', url: '/api/view?view=history&dataset=real', cookie: undefined, host: 'localhost:5173', body: '' }]);
});

it('sends the website host so Sale AI accepts POSTs even when Vite rewrote Host', async () => {
  await request(app).post('/sale-ai/api/table/ensure').set('X-Test-User', '1').set('X-Test-Permissions', 'sale.manage')
    .set('Host', '127.0.0.1:4000').set('Origin', 'http://localhost:5173').send({});
  expect(seen[0].host).toBe('localhost:5173');
});

it('a MacBook on the shop wifi (IP origin) reaches Sale AI as the website itself, which only accepts localhost', async () => {
  const result = await request(app).post('/sale-ai/api/table/ensure').set('X-Test-User', '1').set('X-Test-Permissions', 'sale.manage')
    .set('Host', '127.0.0.1:4000').set('Origin', 'http://192.168.110.213:5173').send({});
  expect(result.status).toBe(200);
  expect([seen[0].host, seen[0].origin]).toEqual(['localhost:5173', 'http://localhost:5173']);
});

it('streams POST bodies unchanged and keeps the same-origin check', async () => {
  const body = { runId: 'r1', codes: ['SP1'], dataset: 'real' };
  const result = await request(app).post('/sale-ai/api/kiot/prepare').set('X-Test-User', '1').set('X-Test-Permissions', 'sale.manage')
    .set('Origin', 'http://localhost:5173').send(body);
  expect(result.status).toBe(200);
  expect(JSON.parse(seen[0].body)).toEqual(body);
  const crossSite = await request(app).post('/sale-ai/api/kiot/commit').set('X-Test-User', '1').set('X-Test-Permissions', 'sale.manage')
    .set('Origin', 'https://evil.test').send({ id: 'x', confirmed: true });
  expect(crossSite.status).toBe(403);
  expect(seen).toHaveLength(1);
});

it('redirects to the trailing slash and reports when Sale AI is down', async () => {
  const redirect = await sale('/sale-ai');
  expect([redirect.status, redirect.headers.location]).toEqual([301, '/sale-ai/']);
  const port = env.SALE_AI_URL;
  env.SALE_AI_URL = 'http://127.0.0.1:1';
  const down = await sale('/sale-ai/api/status');
  // The framed page shows a retrying notice instead of Chrome's blocked-frame screen.
  const page = await sale('/sale-ai/').set('Accept', 'text/html');
  env.SALE_AI_URL = port;
  expect(down.status).toBe(503);
  expect(down.body.error.code).toBe('SALE_AI_DOWN');
  expect([page.status, page.headers['content-security-policy']]).toEqual([503, "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'"]);
  expect(page.text).toContain('http-equiv="refresh" content="5"');
  const signedOut = await request(app).get('/sale-ai/');
  expect([signedOut.status, signedOut.headers['content-security-policy']]).toEqual([401, "default-src 'none'; frame-ancestors 'self'"]);
});
