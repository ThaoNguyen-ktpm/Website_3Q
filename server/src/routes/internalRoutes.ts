import { timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { env } from '../config/env.js';
import type { Permission } from '../config/permissions.js';
import { quickAnswer } from '../services/assistant/graph.js';
import { catalogStore } from '../services/catalogStore.js';
import * as staffModel from '../models/staffModel.js';
import { permissionsFor } from '../services/permissionService.js';

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
  // Bảo 2026-10-20: staff on the bot (not Bảo) get no cost or profit.
  const permissions = request.get('x-bosstele-staff') === '1' ? botPermissions.filter(key => key !== 'products.cost') : botPermissions;
  try { response.json({ answer: await quickAnswer(request.body, permissions) }); }
  catch (error) { next(error); }
});

// Bảo 2026-10-20: BossTele asks what the website allows the staff member linked to a Telegram account; null = no active account.
internalRouter.post('/staff-permissions', async (request, response, next) => {
  try {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : '';
    const staff = email && email.length <= 191 ? await staffModel.findByEmail(email) : null;
    response.json(staff?.status === 'ACTIVE' ? { role: staff.role, permissions: await permissionsFor(staff) } : { role: null, permissions: null });
  } catch (error) { next(error); }
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
