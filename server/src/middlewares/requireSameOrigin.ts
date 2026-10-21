import type { RequestHandler } from 'express';
import { allowedOrigin } from '../config/origins.js';
import { ApiError } from './errorHandler.js';

export const requireSameOrigin: RequestHandler = (request, _response, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next();
  const origin = request.get('Origin');
  const referer = request.get('Referer');
  let refererOrigin: string | undefined;
  try { refererOrigin = referer ? new URL(referer).origin : undefined; } catch { /* not a URL: rejected below */ }
  const valid = allowedOrigin(origin ?? refererOrigin);
  next(valid ? undefined : new ApiError(403, 'BAD_ORIGIN', 'Yêu cầu không hợp lệ.'));
};
