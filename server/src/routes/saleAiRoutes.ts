import http from 'node:http';
import { Router } from 'express';
import { env } from '../config/env.js';
import { allowedOrigin } from '../config/origins.js';

// Bảo 2026-10-19 (TASK-035): the Sale AI tool (D:\BaoQ-AI) is served at /sale-ai/ on the website's own port, behind login,
// sale.manage and the same-origin check (app.ts). Sale AI itself still listens on 127.0.0.1 only. Requests are streamed
// through unchanged (never parsed here, so this router sits before express.json); the website session cookie is not forwarded.
export const saleAiRouter = Router();
saleAiRouter.use((request, response) => {
  // Sale AI uses relative URLs, so its page must live under the trailing slash.
  if (request.originalUrl === '/sale-ai') return response.redirect(301, '/sale-ai/');
  const target = new URL(env.SALE_AI_URL);
  // Sale AI accepts a POST only when Origin is http://<Host> (its own CSRF check). Vite's proxy rewrites Host to the API
  // address, so send the website's own host; requireSameOrigin has already checked Origin against APP_ORIGIN.
  const { cookie: _cookie, ...headers } = request.headers;
  headers.host = new URL(env.APP_ORIGIN).host;
  // Bảo 2026-10-21: Sale AI refuses requests without this token, so 127.0.0.1:4310 cannot be opened directly.
  if (env.INTERNAL_TOKEN) headers['x-sale-ai-token'] = env.INTERNAL_TOKEN; else delete headers['x-sale-ai-token'];
  // Opened by the shop wifi IP (Bảo 2026-10-20): Sale AI only accepts a localhost Host, so the Origin already checked by
  // requireSameOrigin is presented as the website's own.
  if (headers.origin && allowedOrigin(headers.origin)) headers.origin = new URL(env.APP_ORIGIN).origin;
  const upstream = http.request({ hostname: target.hostname, port: target.port, method: request.method, path: request.url, headers }, reply => {
    response.status(reply.statusCode ?? 502);
    for (const [name, value] of Object.entries(reply.headers)) if (value !== undefined) response.setHeader(name, value);
    reply.pipe(response);
  });
  upstream.on('error', () => {
    if (response.headersSent) return response.end();
    // The framed page (right after npm run dev, Sale AI still starting) retries by itself every 5 seconds.
    if (request.method === 'GET' && request.accepts(['json', 'html']) === 'html') return response.status(503).type('html').set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'")
      .send('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="5"><body style="font:15px system-ui;color:#a29fbd;background:#14131e;padding:24px">Sale AI đang khởi động hoặc chưa chạy, tự thử lại sau 5 giây…</body>');
    response.status(503).json({ error: { code: 'SALE_AI_DOWN', message: 'Sale AI chưa chạy. Chạy npm run dev tại D:\\Website_3Q để bật.' } });
  });
  request.pipe(upstream);
});
