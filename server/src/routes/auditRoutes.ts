import { Router } from 'express';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requirePermission } from '../middlewares/requirePermission.js';
import * as audit from '../services/auditService.js';

export const auditRouter = Router();
auditRouter.get('/', requireAuth, requirePermission('audit.view'), async (request, response, next) => {
  try { response.json(await audit.list(request.query)); } catch (error) { next(error); }
});
