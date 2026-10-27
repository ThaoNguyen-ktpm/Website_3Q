import { allPermissions, catalog, permissionLabels, roleLabels, roleNames, rolePermissions, type Permission, type Role } from '../config/permissions.js';
import * as model from '../models/rolePermissionModel.js';

export async function permissionsForRole(role: Role): Promise<Permission[]> {
  if (role === 'ADMIN') return [...allPermissions];
  const rows = await model.list(role);
  if (!rows.length) return [...rolePermissions[role]];
  return allPermissions.filter(key => rows.some(row => row.permission === key));
}
export async function permissionsFor(staff: { role: Role; customPermissions: boolean; permissions?: { permission: string }[] }): Promise<Permission[]> {
  if (staff.role === 'ADMIN') return [...allPermissions];
  if (staff.customPermissions) return allPermissions.filter(key => staff.permissions?.some(row => row.permission === key));
  return permissionsForRole(staff.role);
}
export async function listRoles() {
  return { roles: await Promise.all(roleNames.map(async role => ({ role, label: roleLabels[role], editable: false,
    permissions: (await permissionsForRole(role)).map(key => ({ key, label: permissionLabels[key] })) }))), catalog };
}
