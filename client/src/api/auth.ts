export type AuthUser = { id: number; email: string; fullName: string; role: string; roleLabel: string; permissions: string[]; isPrimaryAdmin: boolean };

async function authRequest(path: string, options?: RequestInit) {
  const response = await fetch(`/api/auth/${path}`, { ...options, credentials: 'include' });
  if (path === 'me' && response.status === 401) return { user: null };
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error?.message ?? 'Không thể kết nối. Vui lòng thử lại sau.');
  }
  return response.status === 204 ? undefined : response.json();
}

export async function getAuthConfig(signal?: AbortSignal): Promise<{ googleClientId: string }> {
  return authRequest('config', { signal });
}
export async function loginWithGoogle(credential: string): Promise<{ user: AuthUser }> {
  return authRequest('google', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ credential }),
  });
}
export async function getMe(signal?: AbortSignal): Promise<{ user: AuthUser | null }> {
  return authRequest('me', { signal });
}
export async function logout(): Promise<void> {
  await authRequest('logout', { method: 'POST' });
}
