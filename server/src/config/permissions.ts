export const permissionLabels = {
  'dashboard.view': 'Xem Tổng quan', 'reports.export': 'Xuất báo cáo CSV',
  'products.view': 'Xem sản phẩm', 'products.edit': 'Thêm, sửa sản phẩm',
  'products.cost': 'Xem giá vốn',
  'orders.view': 'Xem đơn hàng', 'orders.edit': 'Xử lý đơn hàng',
  'customers.view': 'Xem khách hàng', 'customers.edit': 'Sửa khách hàng',
  'staff.view': 'Xem nhân viên', 'staff.manage': 'Quản lý nhân viên và vai trò',
  'settings.manage': 'Sửa cài đặt cửa hàng',
  'audit.view': 'Xem nhật ký thao tác',
};
export type Permission = keyof typeof permissionLabels;
export const roleNames = ['ADMIN', 'MANAGER', 'STAFF'] as const;
export type Role = typeof roleNames[number];
export const roleLabels: Record<Role, string> = {
  ADMIN: 'Admin', MANAGER: 'Quản lý', STAFF: 'Nhân viên',
};
export const allPermissions = Object.keys(permissionLabels) as Permission[];
export const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: allPermissions,
  MANAGER: allPermissions.filter(key => key !== 'staff.manage' && key !== 'settings.manage' && key !== 'audit.view' && key !== 'products.cost'),
  STAFF: ['dashboard.view', 'products.view', 'orders.view', 'orders.edit', 'customers.view', 'customers.edit'],
};
export const catalog = allPermissions.map(key => ({ key, label: permissionLabels[key] }));
