import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middlewares/requireAuth.js';
import { assistantChat } from '../controllers/assistantController.js';

export const assistantRouter = Router();
assistantRouter.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
assistantRouter.use(requireAuth);
export const assistantLimiter = rateLimit({
  windowMs: 60_000, limit: 20, standardHeaders: 'draft-6', legacyHeaders: false,
  keyGenerator: (_request, response) => String(response.locals.user.id),
  message: { error: { code: 'RATE_LIMITED', message: 'Bạn hỏi quá nhanh. Vui lòng thử lại sau một phút.' } },
});
assistantRouter.post('/chat', assistantLimiter, assistantChat);
