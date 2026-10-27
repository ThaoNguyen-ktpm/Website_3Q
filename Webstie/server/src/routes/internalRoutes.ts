import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import type { Permission } from '../config/permissions.js';
import { quickAnswer } from '../services/assistant/graph.js';
import { catalogStore } from '../services/catalogStore.js';

// Bảo 2026-10-19 (TASK-032): the BossTele Telegram bot is used only by Bảo (admin), so it reads products with cost.
const botPermissions: Permission[] = ['products.view', 'products.cost'];
const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const sameToken = (given: string, token: string) => given.length === token.length && timingSafeEqual(Buffer.from(given), Buffer.from(token));

export const internalRouter = Router();
// Anything not from this machine with the token falls through to the normal 404.
internalRouter.use((request, response, next) => {
  const token = env.INTERNAL_TOKEN;
  if (!token || !loopback.has(request.socket.remoteAddress ?? '') || !sameToken(request.get('x-internal-token') ?? '', token)) return next('router');
  response.set('Cache-Control', 'no-store');
  next();
});
internalRouter.post('/assistant', async (request, response, next) => {
  try { response.json({ answer: await quickAnswer(request.body, botPermissions) }); }
  catch (error) { next(error); }
});

// Sale AI's "Tải lại sản phẩm từ Kiot" (TASK-036): one KiotViet download, shared by the website catalog and Sale AI.
internalRouter.post('/catalog/sync', async (_request, response, next) => {
  try {
    await catalogStore.sync();
    const snapshot = catalogStore.rawRows('kiotviet');
    if (snapshot.status !== 'ok' || !snapshot.complete) {
      response.status(502).json({ error: { code: 'CATALOG_SYNC_FAILED', message: snapshot.message ?? 'Chưa tải được đủ danh mục KiotViet. Vui lòng thử lại.' } });
      return;
    }
    response.json(snapshot);
  } catch (error) { next(error); }
});
