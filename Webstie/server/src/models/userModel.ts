import { prisma } from './prisma.js';

const select = { id: true, email: true, role: true, googleSub: true } as const;

export const findUserByGoogleSub = (googleSub: string) =>
  prisma.user.findUnique({ where: { googleSub }, select });
export const findUserByEmail = (email: string) =>
  prisma.user.findUnique({ where: { email }, select });
export const findUserById = (id: number) =>
  prisma.user.findUnique({ where: { id }, select });
export const linkGoogleSub = (id: number, googleSub: string) =>
  prisma.user.update({ where: { id }, data: { googleSub }, select });
export const createGoogleUser = (email: string, googleSub: string) =>
  prisma.user.create({ data: { email, googleSub, role: 'CUSTOMER' }, select });
