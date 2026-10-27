import { useCallback, useEffect, useState } from 'react';
import { getMe, logout, type AuthUser } from '../api/auth';

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const expireSession = useCallback(() => setUser(null), []);
  useEffect(() => {
    const controller = new AbortController();
    getMe(controller.signal)
      .then(({ user }) => { if (!controller.signal.aborted) setUser(user); })
      .catch(() => {
        if (!controller.signal.aborted) setError('Không thể kiểm tra phiên đăng nhập.');
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  async function signOut() {
    setError('');
    try { await logout(); setUser(null); return true; }
    catch { setError('Không thể đăng xuất. Vui lòng thử lại.'); return false; }
  }

  return { user, setUser, loading, error, signOut, expireSession };
}

export type AuthState = ReturnType<typeof useAuth>;
