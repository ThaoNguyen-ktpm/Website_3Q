import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { ApiError } from './errorHandler.js';

export const requireSameOrigin: RequestHandler = (request, _response, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next();
  const origin = request.get('Origin');
  const valid = origin !== undefined
    ? origin === env.APP_ORIGIN
    : request.get('Referer')?.startsWith(`${env.APP_ORIGIN}/`);
  next(valid ? undefined : new ApiError(403, 'BAD_ORIGIN', 'Yêu cầu không hợp lệ.'));
};
