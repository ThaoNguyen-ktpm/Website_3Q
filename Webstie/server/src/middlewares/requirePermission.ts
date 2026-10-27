import type { RequestHandler } from 'express';
import type { Permission } from '../config/permissions.js';
import { ApiError } from './errorHandler.js';

export const requirePermission = (key: Permission): RequestHandler => (_request, response, next) => {
  if (!response.locals.user?.permissions.includes(key)) {
    next(new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'));
    return;
  }
  next();
};
