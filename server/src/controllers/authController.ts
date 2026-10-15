import type { CookieOptions, RequestHandler } from 'express';
import { z } from 'zod';
import { ApiError } from '../middlewares/errorHandler.js';
import * as auth from '../services/authService.js';

const bodySchema = z.strictObject({ credential: z.string().min(1).max(4096) });
const cookieOptions = (): CookieOptions => ({
  httpOnly: true, sameSite: 'lax', path: '/', secure: process.env.NODE_ENV === 'production',
});

export const getConfig: RequestHandler = (_request, response, next) => {
  try { response.json(auth.getAuthConfig()); } catch (error) { next(error); }
};

export const googleLogin: RequestHandler = async (request, response, next) => {
  try {
    auth.getAuthConfig();
    const body = bodySchema.safeParse(request.body);
    if (!body.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Thông tin đăng nhập không hợp lệ.');
    const user = await auth.loginWithGoogle(body.data.credential);
    response.cookie('sid', auth.createSession(user.id), {
      ...cookieOptions(), signed: true, maxAge: auth.sessionMaxAge,
    });
    response.json({ user });
  } catch (error) { next(error); }
};

export const getMe: RequestHandler = async (request, response, next) => {
  try {
    const user = await auth.readSession(request.signedCookies?.sid);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Bạn chưa đăng nhập.');
    response.json({ user });
  } catch (error) { next(error); }
};

export const logout: RequestHandler = (_request, response) => {
  response.clearCookie('sid', cookieOptions());
  response.status(204).end();
};
