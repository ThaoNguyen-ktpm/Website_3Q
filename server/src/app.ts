import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/healthRoutes.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';

export const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/health', healthRouter);
app.use(notFound);
app.use(errorHandler);
