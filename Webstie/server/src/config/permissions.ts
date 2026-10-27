export const permissionLabels = {
  'dashboard.view': 'Xem Tổng quan', 'reports.export': 'Xuất báo cáo CSV',
  'products.view': 'Xem sản phẩm', 'products.edit': 'Thêm, sửa sản phẩm',
  'products.cost': 'Xem giá vốn',
  'orders.view': 'Xem đơn hàng', 'orders.edit': 'Xử lý đơn hàng',
  'customers.view': 'Xem khách hàng', 'customers.edit': 'Sửa khách hàng',
  'staff.view': 'Xem nhân viên', 'staff.manage': 'Quản lý nhân viên và vai trò',
  'settings.manage': 'Sửa cài đặt cửa hàng',
  'audit.view': 'Xem nhật ký thao tác',
  'documents.view': 'Xem và hỏi đáp tài liệu', 'documents.manage': 'Tải lên và xóa tài liệu',
  'sale.manage': 'Tính và cập nhật giá sale (Sale AI)',
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
  MANAGER: allPermissions.filter(key => key !== 'staff.manage' && key !== 'settings.manage' && key !== 'audit.view' && key !== 'products.cost' && key !== 'documents.manage' && key !== 'sale.manage'),
  STAFF: ['dashboard.view', 'products.view', 'orders.view', 'orders.edit', 'customers.view', 'customers.edit'],
};
// Bảo 2026-10-20: the staff form lists only permissions of pages that work with real data. The others (sample pages hidden from the
// menu, Tài liệu turned off) stay valid keys so roles and saved staff keep working; remove a key here to show it again.
export const hiddenPermissions: Permission[] = ['dashboard.view', 'reports.export', 'products.edit', 'orders.view', 'orders.edit',
  'customers.view', 'customers.edit', 'settings.manage', 'documents.view', 'documents.manage'];
export const catalog = allPermissions.filter(key => !hiddenPermissions.includes(key)).map(key => ({ key, label: permissionLabels[key] }));
