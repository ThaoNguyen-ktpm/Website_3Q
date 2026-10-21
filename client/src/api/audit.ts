export const auditActions = {
  'auth.login': 'Đăng nhập', 'auth.login_denied': 'Đăng nhập bị từ chối', 'auth.logout': 'Đăng xuất',
  'staff.create': 'Thêm nhân viên', 'staff.update': 'Sửa nhân viên',
  'document.upload': 'Tải lên tài liệu', 'document.delete': 'Xóa tài liệu',
};
export type AuditItem = {
  id: number; actorId: number | null; actorEmail: string | null; action: string; actionLabel: string;
  targetType: string | null; targetId: string | null; before: Record<string, unknown> | null;
  after: Record<string, unknown> | null; ip: string | null; createdAt: string;
};
export async function listAuditLogs(filters: { action: string; actorId: string; page: number }, signal?: AbortSignal): Promise<{ items: AuditItem[]; total: number; page: number; pageSize: number }> {
  const query = new URLSearchParams({ page: String(filters.page) });
  if (filters.action) query.set('action', filters.action);
  if (filters.actorId) query.set('actorId', filters.actorId);
  const response = await fetch(`/api/audit-logs?${query}`, { credentials: 'include', signal });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Không thể tải nhật ký. Vui lòng thử lại.');
  return data;
}
