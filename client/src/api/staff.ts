export type Staff = {
  isPrimaryAdmin: boolean;
  customPermissions: boolean; permissions: string[];
  id: number; email: string; fullName: string; phone: string | null;
  role: string; roleLabel: string; status: 'ACTIVE' | 'DISABLED'; lastLoginAt: string | null;
};
export type StaffRole = { role: string; label: string; editable: boolean; permissions: { key: string; label: string }[] };
export type StaffDraft = Pick<Staff, 'email' | 'fullName' | 'phone' | 'role' | 'status'> & { permissions?: string[] | null };
async function request(path = '', options?: RequestInit) {
  const response = await fetch(`/api/staff${path}`, { ...options, credentials: 'include' });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Không thể tải dữ liệu nhân viên. Vui lòng thử lại.');
  return data;
}
export async function listStaff(signal?: AbortSignal): Promise<{ staff: Staff[] }> { return request('', { signal }); }
export async function listRoles(signal?: AbortSignal): Promise<{ roles: StaffRole[]; catalog: { key: string; label: string }[] }> { return request('/roles', { signal }); }
export async function createStaff(draft: StaffDraft): Promise<{ staff: Staff }> {
  return request('', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
}
export async function updateStaff(id: number, draft: Omit<StaffDraft, 'email'>): Promise<{ staff: Staff }> {
  return request(`/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
}

