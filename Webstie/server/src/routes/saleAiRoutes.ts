import { Router } from 'express';
import { getSaleAi } from '../sale-ai/runtime.js';
// TASK-104: embedded handler, after login, sale.manage and same-origin in app.ts.
export function createSaleAiRouter(resolveCore = getSaleAi) {
 const router = Router();
 router.use((request, response) => {
 if (request.originalUrl === '/sale-ai') return response.redirect(301, '/sale-ai/');
 const core = resolveCore();
 if (core) return void core.handler(request, response);
 response.set('Cache-Control', 'no-store');
 if (request.method === 'GET' && request.accepts(['json', 'html']) === 'html') {
  return response.status(503).type('html').set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self'")
   .send('<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="5"><body style="font:15px system-ui;padding:24px">Sale AI đang khởi động hoặc tạm thời không khả dụng; tự thử lại sau 5 giây…</body>');
 }
 response.status(503).json({ error: 'Sale AI đang khởi động hoặc tạm thời không khả dụng. Vui lòng thử lại.' });
});
 return router;
}
export const saleAiRouter = createSaleAiRouter();
