import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sessionCookieName, sessionCookieOptions } from '../config/sessionCookie.js';
import { ApiError } from '../middlewares/errorHandler.js';
import * as auth from '../services/authService.js';
import * as audit from '../services/auditService.js';
import { isPrimaryAdmin } from '../config/primaryAdmin.js';

const bodySchema = z.strictObject({ credential: z.string().min(1).max(4096) });
export const getConfig: RequestHandler = (_request, response, next) => {
  try { response.json(auth.getAuthConfig()); } catch (error) { next(error); }
};

export const googleLogin: RequestHandler = async (request, response, next) => {
  try {
    auth.getAuthConfig();
    const body = bodySchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Thông tin đăng nhập không hợp lệ.');
    const user = await auth.loginWithGoogle(body.data.credential, request.ip);
    response.cookie(sessionCookieName(), auth.createSession(user.id), {
      ...sessionCookieOptions(), signed: true, maxAge: auth.sessionMaxAge,
    });
    response.json({ user: { ...user, isPrimaryAdmin: isPrimaryAdmin(user.email) } });
  } catch (error) { next(error); }
};

export const getMe: RequestHandler = async (request, response, next) => {
  try {
    const user = await auth.readSession(request.signedCookies?.[sessionCookieName()]);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Bạn chưa đăng nhập.');
    response.json({ user: { ...user, isPrimaryAdmin: isPrimaryAdmin(user.email) } });
  } catch (error) { next(error); }
};

export const logout: RequestHandler = async (request, response) => {
  try {
    const user = await auth.readSession(request.signedCookies?.[sessionCookieName()]);
    if (user) await audit.record({ actor: user, action: 'auth.logout', ip: request.ip });
  } catch { console.error('Không thể xác định người đăng xuất để ghi nhật ký.'); }
  response.clearCookie(sessionCookieName(), sessionCookieOptions());
  response.status(204).end();
};
