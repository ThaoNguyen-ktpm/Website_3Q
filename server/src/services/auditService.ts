import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ApiError } from '../middlewares/errorHandler.js';
import * as model from '../models/auditLogModel.js';

export const actionLabels = {
  'auth.login': 'Đăng nhập', 'auth.login_denied': 'Đăng nhập bị từ chối', 'auth.logout': 'Đăng xuất',
  'staff.create': 'Thêm nhân viên', 'staff.update': 'Sửa nhân viên', 'staff.login_link': 'Tạo link đăng nhập',
  'document.upload': 'Tải lên tài liệu', 'document.delete': 'Xóa tài liệu',
};
type Snapshot = Record<string, unknown>;
type AuditRecord = {
  actor?: { id?: number; email?: string }; action: keyof typeof actionLabels;
  targetType?: string; targetId?: string | number; before?: Snapshot; after?: Snapshot; ip?: string;
};
const dateFields = ['createdAt', 'updatedAt', 'lastLoginAt'];
const stringFields = ['email', 'fullName', 'phone', 'role', 'status', 'roleLabel', 'reason', ...dateFields];
// Only scalar staff fields and permission keys may cross the audit boundary.
function safeSnapshot(value?: Snapshot) {
  if (!value) return undefined;
  return Object.fromEntries(Object.entries(value).map(([key, item]) =>
    [key, dateFields.includes(key) && item instanceof Date ? item.toISOString() : item] as const,
  ).filter(([key, item]) =>
    (stringFields.includes(key) && (typeof item === 'string' || item === null)) ||
    (key === 'id' && typeof item === 'number') ||
    (key === 'customPermissions' && typeof item === 'boolean') ||
    (key === 'permissions' && Array.isArray(item) && item.every(key => typeof key === 'string')),
  )) as Prisma.InputJsonObject;
}
export async function record(input: AuditRecord) {
  try {
    await model.create({ actorId: input.actor?.id, actorEmail: input.actor?.email?.slice(0, 191),
      action: input.action, targetType: input.targetType, targetId: input.targetId?.toString(),
      before: safeSnapshot(input.before), after: safeSnapshot(input.after), ip: input.ip?.slice(0, 64) });
  } catch { console.error('Không thể ghi nhật ký thao tác.'); }
}
const positiveInteger = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(2147483647));
const querySchema = z.strictObject({
  action: z.enum(Object.keys(actionLabels) as [keyof typeof actionLabels, ...Array<keyof typeof actionLabels>]).optional(),
  actorId: positiveInteger.optional(), page: positiveInteger.default(1),
  pageSize: positiveInteger.pipe(z.number().max(100)).default(25),
}).refine(value => (value.page - 1) * value.pageSize <= 2147483647);
export async function list(query: unknown) {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Bộ lọc nhật ký không hợp lệ.');
  const { action, actorId, page, pageSize } = parsed.data;
  const result = await model.list({ ...(action ? { action } : {}), ...(actorId ? { actorId } : {}) }, page, pageSize);
  return { ...result, items: result.items.map(item => ({ ...item, actionLabel: actionLabels[item.action as keyof typeof actionLabels] ?? item.action })) };
}
export async function purgeOlderThan(days: number) {
  if (!Number.isInteger(days) || days <= 0) throw new Error('Thời hạn lưu nhật ký không hợp lệ.');
  return model.deleteBefore(new Date(Date.now() - days * 86400000));
}
export function startRetention(days = 365) {
  const purge = () => { void purgeOlderThan(days).catch(() => console.error('Không thể dọn nhật ký thao tác cũ.')); };
  purge();
  const timer = setInterval(purge, 86400000);
  timer.unref();
  return timer;
}
