import type { RequestHandler } from 'express';
import * as staff from '../services/staffService.js';
import * as permissions from '../services/permissionService.js';
import { isPrimaryAdmin } from '../config/primaryAdmin.js';
import { ApiError } from '../middlewares/errorHandler.js';

export const getStaff: RequestHandler = async (_request, response, next) => {
  try { response.json({ staff: (await staff.list()).map(person => ({ ...person, isPrimaryAdmin: isPrimaryAdmin(person.email) })) }); } catch (error) { next(error); }
};
export const getRoles: RequestHandler = async (_request, response, next) => {
  try { response.json(await permissions.listRoles()); } catch (error) { next(error); }
};
export const createStaff: RequestHandler = async (request, response, next) => {
  try {
    const person = await staff.create(response.locals.user, request.body, request.ip);
    response.status(201).json({ staff: { ...person, isPrimaryAdmin: isPrimaryAdmin(person.email) } });
  } catch (error) { next(error); }
};
export const createLoginLink: RequestHandler = async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const target = await staff.getById(id);
    if (isPrimaryAdmin(target?.email) && !isPrimaryAdmin(response.locals.user.email)) {
      throw new ApiError(403, 'FORBIDDEN', 'Không thể tạo link cho tài khoản Admin chính.');
    }
    response.json(await staff.loginLink(response.locals.user, id, request.ip, request.get('origin')));
  } catch (error) { next(error); }
};
export const updateStaff: RequestHandler = async (request, response, next) => {
  try {
    const id = Number(request.params.id);
    const target = await staff.getById(id);
    if (isPrimaryAdmin(target?.email) && !isPrimaryAdmin(response.locals.user.email)) {
      throw new ApiError(403, 'FORBIDDEN', 'Không thể thay đổi tài khoản Admin chính.');
    }
    const person = await staff.update(response.locals.user, id, request.body, request.ip);
    response.json({ staff: { ...person, isPrimaryAdmin: isPrimaryAdmin(person.email) } });
  } catch (error) { next(error); }
};
