import { rateLimit } from 'express-rate-limit';

export function createLimiter(limit: number, enforceInTest = false) {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: 'draft-6',
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === 'test' && !enforceInTest,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' } },
  });
}

export const authLimiter = createLimiter(10);
export const apiLimiter = createLimiter(300);
