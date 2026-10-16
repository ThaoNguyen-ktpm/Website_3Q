import type { Role } from '../config/permissions.js';
import { prisma } from './prisma.js';

// An empty marker distinguishes an explicitly cleared role from unconfigured defaults.
export const emptyPermissionsMarker = '__EMPTY__';
export const list = (role: Role): Promise<{ permission: string }[]> =>
  prisma.rolePermission.findMany({ where: { role }, select: { permission: true } });
