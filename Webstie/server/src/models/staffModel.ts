import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export type StaffDb = Pick<Prisma.TransactionClient, 'staff'>;
export const findByEmail = (email: string, db: StaffDb = prisma) => db.staff.findUnique({ where: { email }, include: { permissions: true } });
export const findById = (id: number, db: StaffDb = prisma) => db.staff.findUnique({ where: { id }, include: { permissions: true } });
export const findByGoogleSub = (googleSub: string, db: StaffDb = prisma) => db.staff.findUnique({ where: { googleSub }, include: { permissions: true } });
export const list = () => prisma.staff.findMany({ orderBy: { id: 'asc' }, include: { permissions: true } });
export const create = (data: Prisma.StaffCreateInput, db: StaffDb = prisma) => db.staff.create({ data, include: { permissions: true } });
export const update = (id: number, data: Prisma.StaffUpdateInput, db: StaffDb = prisma) => db.staff.update({ where: { id }, data, include: { permissions: true } });
export const countActiveAdmins = (db: StaffDb = prisma) => db.staff.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });

// Serializable prevents two admins concurrently removing each other's last active admin.
export async function transaction<T>(action: (db: StaffDb) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await prisma.$transaction(action, { isolationLevel: 'Serializable' }); }
    catch (error) {
      if (attempt >= 2 || !error || typeof error !== 'object' || !('code' in error) || error.code !== 'P2034') throw error;
    }
  }
}
