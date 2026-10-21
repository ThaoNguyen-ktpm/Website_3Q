import { Router } from 'express';
import { getConfig, getMe, googleLogin, linkLogin, logout } from '../controllers/authController.js';

export const authRouter = Router();
authRouter.get('/config', getConfig);
authRouter.post('/google', googleLogin);
authRouter.post('/link', linkLogin);
authRouter.get('/me', getMe);
authRouter.post('/logout', logout);
