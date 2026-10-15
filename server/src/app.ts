import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRouter } from './routes/authRoutes.js';
import { healthRouter } from './routes/healthRoutes.js';
import { productRouter } from './routes/productRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { requireAuth } from './middlewares/requireAuth.js';

export const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser(env.SESSION_SECRET));
app.use('/api/auth', authRouter);
app.use('/api/health', healthRouter);
app.use('/api/products', requireAuth, productRouter);
app.use(notFound);
app.use(errorHandler);
