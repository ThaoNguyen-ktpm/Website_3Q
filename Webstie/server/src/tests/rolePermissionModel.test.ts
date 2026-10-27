import { expect, it, vi } from 'vitest';
import { prisma } from '../models/prisma.js';
import { list } from '../models/rolePermissionModel.js';
vi.mock('../models/prisma.js', () => ({ prisma: { rolePermission: { findMany: vi.fn() } } }));
it('reads the role template without writing it', async () => {
 vi.mocked(prisma.rolePermission.findMany).mockResolvedValue([]);
 expect(await list('STAFF')).toEqual([]);
 expect(prisma.rolePermission.findMany).toHaveBeenCalledWith({where:{role:'STAFF'},select:{permission:true}});
});
