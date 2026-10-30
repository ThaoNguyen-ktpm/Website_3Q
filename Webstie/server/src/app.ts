import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { apiLimiter, authLimiter } from './middlewares/rateLimit.js';
import { requireSameOrigin } from './middlewares/requireSameOrigin.js';
import { env } from './config/env.js';
import { authRouter } from './routes/authRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { catalogRouter } from './routes/catalogRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { requireAuth } from './middlewares/requireAuth.js';

import { staffRouter } from './routes/staffRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { requirePermission } from './middlewares/requirePermission.js';
import { documentRouter } from './routes/documentRoutes.js';
import { assistantRouter } from './routes/assistantRoutes.js';
import { internalRouter } from './routes/internalRoutes.js';
import { saleAiRouter } from './routes/saleAiRoutes.js';

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
app.use('/api/auth/link', authLimiter);
// Before express.json: Sale AI parses its bounded request bodies in the embedded handler.
// The admin page frames /sale-ai/: its errors (not signed in, Sale AI starting) must show in the frame, not as Chrome's "content is blocked".
// Same origin only; embedded Sale AI pages replace this with their own CSP.
app.use('/sale-ai', (_request, response, next) => { response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'self'"); next(); },
  cookieParser(env.SESSION_SECRET), requireAuth, requirePermission('sale.manage'), requireSameOrigin, saleAiRouter);
app.use(express.json());
app.use(cookieParser(env.SESSION_SECRET));
// Outside /api: never proxied to the browser; loopback + INTERNAL_TOKEN only.
app.use('/internal', internalRouter);
app.use('/api/auth', authRouter);
app.use('/api/health', healthRouter);
app.use('/api/catalog', requireAuth, requirePermission('products.view'), catalogRouter);
app.use('/api/staff', staffRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/documents', documentRouter);
app.use('/api/assistant', assistantRouter);
app.use(notFound);
app.use(errorHandler);
