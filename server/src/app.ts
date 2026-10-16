import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { apiLimiter, authLimiter } from './middlewares/rateLimit.js';
import { requireSameOrigin } from './middlewares/requireSameOrigin.js';
import { env } from './config/env.js';
import { authRouter } from './routes/authRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { productRouter } from './routes/productRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { requireAuth } from './middlewares/requireAuth.js';

import { staffRouter } from './routes/staffRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { requirePermission } from './middlewares/requirePermission.js';

export const app = express();
app.disable('x-powered-by');
if (env.TRUST_PROXY !== undefined) app.set('trust proxy', env.TRUST_PROXY);
app.use(helmet({
  contentSecurityPolicy: { useDefaults: false, directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy: { policy: 'no-referrer' },
  strictTransportSecurity: process.env.NODE_ENV === 'production'
    ? { maxAge: 15552000, includeSubDomains: true } : false,
}));
app.use(cors({ origin: env.APP_ORIGIN, credentials: true }));
app.use('/api', apiLimiter, requireSameOrigin);
app.use('/api/auth/google', authLimiter);
app.use(express.json());
app.use(cookieParser(env.SESSION_SECRET));
app.use('/api/auth', authRouter);
app.use('/api/health', healthRouter);
app.use('/api/products', requireAuth, requirePermission('products.view'), productRouter);
app.use('/api/staff', staffRouter);
app.use('/api/audit-logs', auditRouter);
app.use(notFound);
app.use(errorHandler);
