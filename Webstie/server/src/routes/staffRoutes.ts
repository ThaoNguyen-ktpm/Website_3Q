import { Router } from 'express';
import { getStaff, getRoles, createStaff, updateStaff, createLoginLink } from '../controllers/staffController.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';

export const staffRouter = Router();
staffRouter.use(requireAuth);
staffRouter.get('/roles', requirePermission('staff.view'), getRoles);
staffRouter.get('/', requirePermission('staff.view'), getStaff);
staffRouter.post('/', requirePermission('staff.manage'), createStaff);
staffRouter.patch('/:id', requirePermission('staff.manage'), updateStaff);
staffRouter.post('/:id/login-link', requirePermission('staff.manage'), createLoginLink);
