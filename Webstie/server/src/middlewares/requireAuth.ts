import type { RequestHandler } from 'express';
import { sessionCookieName } from '../config/sessionCookie.js';
import { readSession } from '../services/authService.js';
import { ApiError } from './errorHandler.js';

export const requireAuth: RequestHandler = async (request, response, next) => {
  try {
    const user = await readSession(request.signedCookies?.[sessionCookieName()]);
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Bạn chưa đăng nhập.');
    response.locals.user = user;
    next();
  } catch (error) { next(error); }
};
