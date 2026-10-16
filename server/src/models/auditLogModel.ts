import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export const create = (data: Prisma.AuditLogCreateInput) => prisma.auditLog.create({ data });
export async function list(where: Prisma.AuditLogWhereInput, page: number, pageSize: number) {
  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count({ where }),
  ]);
  return { items, total, page, pageSize };
}
export const deleteBefore = (cutoff: Date) => prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
