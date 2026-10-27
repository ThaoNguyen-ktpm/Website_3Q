import { Router, raw, type ErrorRequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import { ApiError } from '../middlewares/errorHandler.js';
import { maxPdfBytes } from '../services/documentIngestService.js';
import { listDocuments, uploadDocument, removeDocument, askDocumentQuestion } from '../controllers/documentController.js';

export const documentRouter = Router();
documentRouter.use(requireAuth);
export const documentAskLimiter = rateLimit({
  windowMs: 60_000, limit: 20, standardHeaders: 'draft-6', legacyHeaders: false,
  keyGenerator: (_request, response) => String(response.locals.user.id),
  message: { error: { code: 'RATE_LIMITED', message: 'Bạn hỏi quá nhanh. Vui lòng thử lại sau một phút.' } },
});
documentRouter.get('/', requirePermission('documents.view'), listDocuments);
documentRouter.post('/ask', requirePermission('documents.view'), documentAskLimiter, askDocumentQuestion);
documentRouter.post('/', requirePermission('documents.manage'), (request, _response, next) => {
  if (!request.is('application/pdf')) return next(new ApiError(400, 'INVALID_PDF', 'Chọn tài liệu PDF hợp lệ, tối đa 20 MB.'));
  next();
}, raw({ type: 'application/pdf', limit: maxPdfBytes, inflate: false }), uploadDocument);
documentRouter.delete('/:id', requirePermission('documents.manage'), removeDocument);
const uploadError: ErrorRequestHandler = (error: unknown, _request, _response, next) => {
  if (typeof error === 'object' && error !== null && 'type' in error && ['entity.too.large', 'encoding.unsupported'].includes(String(error.type))) {
    return next(new ApiError(400, 'INVALID_PDF', 'Chọn tài liệu PDF hợp lệ, tối đa 20 MB; không nén nội dung gửi lên.'));
  }
  next(error);
};
documentRouter.use(uploadError);
