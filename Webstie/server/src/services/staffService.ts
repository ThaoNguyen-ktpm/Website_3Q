import type { Staff } from '@prisma/client';
import { z } from 'zod';
import { allPermissions, roleNames, roleLabels, type Permission, type Role } from '../config/permissions.js';
import { permissionsFor, permissionsForRole } from './permissionService.js';
import * as model from '../models/staffModel.js';
import { ApiError } from '../middlewares/errorHandler.js';
import * as audit from './auditService.js';
import { env } from '../config/env.js';
import { createLink, lanOrigin } from './loginLinkService.js';

export const publicUser = async (staff: Staff) => ({ id: staff.id, email: staff.email, fullName: staff.fullName,
  role: staff.role, roleLabel: roleLabels[staff.role], permissions: await permissionsFor(staff) });
export type Actor = { id: number; email?: string; role: Role; permissions: Permission[] };
const fields = {
  email: z.string().trim().toLowerCase().max(191).pipe(z.email()),
  fullName: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(20).regex(/^[0-9 +]*$/).nullable().optional(),
  permissions: z.array(z.enum(allPermissions as [Permission, ...Permission[]])).refine(keys => new Set(keys).size === keys.length).nullable().optional(),
  role: z.enum(roleNames), status: z.enum(['ACTIVE', 'DISABLED']),
};
const createSchema = z.strictObject({ ...fields, role: fields.role.default('STAFF'), status: fields.status.default('ACTIVE') });
const updateSchema = z.strictObject(fields).partial().refine(value => Object.keys(value).length > 0);
const safeStaff = async ({ googleSub: _sub, ...staff }: Staff & { permissions?: { permission: string }[] }) => ({ ...staff, roleLabel: roleLabels[staff.role], permissions: await permissionsFor(staff) });
export const list = async () => Promise.all((await model.list()).map(safeStaff));
export async function getById(id: number) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Mã nhân viên không hợp lệ.');
  const target = await model.findById(id);
  return target ? { id: target.id, email: target.email } : null;
}
function denied(): never { throw new ApiError(403, 'FORBIDDEN', 'Bạn không có quyền thực hiện thao tác này.'); }
function canManage(actor: Actor) { if (!actor.permissions.includes('staff.manage')) denied(); }
function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Thông tin nhân viên không hợp lệ.');
  return result.data;
}
async function emailConflict<T>(action: () => Promise<T>): Promise<T> {
  try { return await action(); } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new ApiError(409, 'EMAIL_EXISTS', 'Email này đã có trong danh sách nhân viên.');
    }
    throw error;
  }
}
async function permissionData(actor: Actor, role: Role, permissions: Permission[] | null | undefined) {
  const defaults = await permissionsForRole(role);
  const effective = role === 'ADMIN' ? defaults : permissions ?? defaults;
  if (role !== 'ADMIN' && actor.role !== 'ADMIN' && effective.some(key => !actor.permissions.includes(key))) denied();
  const customPermissions = role !== 'ADMIN' && permissions != null &&
    (permissions.length !== defaults.length || defaults.some(key => !permissions.includes(key)));
  return { customPermissions, permissions: { deleteMany: {}, create: customPermissions ? effective.map(permission => ({ permission })) : [] } };
}
/** A one-time sign-in link for a staff member on another laptop of the shop wifi (Bảo 2026-10-20); the code is never logged. */
export async function loginLink(actor: Actor, id: number, ip?: string) {
  canManage(actor);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Mã nhân viên không hợp lệ.');
  const target = await model.findById(id);
  if (!target) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy nhân viên.');
  if (target.status !== 'ACTIVE') throw new ApiError(400, 'STAFF_DISABLED', 'Nhân viên đang tạm ngưng; bật lại trước khi tạo link.');
  if (target.role === 'ADMIN' && actor.role !== 'ADMIN') denied();
  const link = createLink(target.id);
  await audit.record({ actor, action: 'staff.login_link', targetType: 'staff', targetId: target.id, after: { email: target.email, expiresAt: link.expiresAt }, ip });
  return { url: `${lanOrigin(env.APP_ORIGIN)}/dang-nhap?ma=${link.code}`, expiresAt: link.expiresAt };
}
export async function create(actor: Actor, body: unknown, ip?: string) {
  canManage(actor);
  const { permissions, ...data } = parse(createSchema, body);
  if (data.role === 'ADMIN' && actor.role !== 'ADMIN') denied();
  const created = await emailConflict(async () => {
    if (await model.findByEmail(data.email)) throw new ApiError(409, 'EMAIL_EXISTS', 'Email này đã có trong danh sách nhân viên.');
    const { permissions: rows, ...flags } = await permissionData(actor, data.role, permissions);
    return model.transaction(async db => safeStaff(await model.create({ ...data, ...flags, permissions: { create: rows.create } }, db)));
  });
  await audit.record({ actor, action: 'staff.create', targetType: 'staff', targetId: created.id, after: created, ip });
  return created;
}
export async function update(actor: Actor, id: number, body: unknown, ip?: string) {
  canManage(actor);
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError(400, 'VALIDATION_ERROR', 'Mã nhân viên không hợp lệ.');
  const { permissions, ...data } = parse(updateSchema, body);
  const { saved, before, after } = await emailConflict(() => model.transaction(async db => {
    const target = await model.findById(id, db);
    if (!target) throw new ApiError(404, 'NOT_FOUND', 'Không tìm thấy nhân viên.');
    if (data.email !== undefined && data.email !== target.email) throw new ApiError(400, 'VALIDATION_ERROR', 'Không thể sửa email nhân viên.');
    if (actor.role !== 'ADMIN' && data.role && data.role !== target.role && (data.role === 'ADMIN' || target.role === 'ADMIN')) denied();
    if (id === actor.id && permissions !== undefined) denied();
    if (id === actor.id && ((data.role && data.role !== target.role) || data.status === 'DISABLED')) denied();
    if (target.role === 'ADMIN' && target.status === 'ACTIVE' &&
        ((data.role && data.role !== 'ADMIN') || data.status === 'DISABLED') && await model.countActiveAdmins(db) <= 1) {
      throw new ApiError(409, 'LAST_ADMIN', 'Hệ thống phải còn ít nhất một Admin đang hoạt động.');
    }
    const role = data.role ?? target.role;
    const reset = permissions !== undefined || role !== target.role;
    const grants = reset || role === 'ADMIN' ? await permissionData(actor, role, permissions) : {};
    const previous = await safeStaff(target);
    const saved = await safeStaff(await model.update(id, { ...data, ...grants }, db));
    const before: Record<string, unknown> = {}, after: Record<string, unknown> = {};
    for (const key of ['fullName', 'phone', 'role', 'status', 'customPermissions', 'permissions'] as const) {
      const oldValue = previous[key], newValue = saved[key];
      const equal = key === 'permissions'
        ? JSON.stringify([...previous.permissions].sort()) === JSON.stringify([...saved.permissions].sort())
        : oldValue === newValue;
      if (!equal) { before[key] = oldValue; after[key] = newValue; }
    }
    return { saved, before, after };
  }));
  await audit.record({ actor, action: 'staff.update', targetType: 'staff', targetId: id, before, after, ip });
  return saved;
}
