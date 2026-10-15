import { Router } from 'express';
import { getConfig, getMe, googleLogin, logout } from '../controllers/authController.js';

export const authRouter = Router();
authRouter.get('/config', getConfig);
authRouter.post('/google', googleLogin);
authRouter.get('/me', getMe);
authRouter.post('/logout', logout);
