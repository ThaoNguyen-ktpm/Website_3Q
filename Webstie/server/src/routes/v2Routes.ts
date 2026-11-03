import express from 'express';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../middlewares/errorHandler.js';

export const v2Router = express.Router();
// overview is ADMIN-only in frontend/access.ts; dashboard.view is also granted to staff.
v2Router.use((_request, response, next) => {
  if (response.locals.user?.role !== 'ADMIN') {
    next(new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'));
    return;
  }
  response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
  next();
});

// This single fixed file is outside the static root, in both src and dist layouts.
v2Router.get('/mockup/kpi/snapshot.json', async (_request, response, next) => {
  try {
    const snapshot = await readFile(new URL('../../data/v2/kpi-snapshot.json', import.meta.url));
    response.type('json').send(snapshot);
  } catch (error) {
    next((error as NodeJS.ErrnoException).code === 'ENOENT'
      ? new ApiError(404, 'NOT_FOUND', 'Chưa đủ dữ liệu.')
      : new ApiError(500, 'SNAPSHOT_UNAVAILABLE', 'Không thể đọc dữ liệu KPI.'));
  }
});
v2Router.use('/mockup', express.static(fileURLToPath(new URL('../v2/mockup/', import.meta.url)), {
  index: false, dotfiles: 'deny', cacheControl: false, etag: false, lastModified: false,
}));
