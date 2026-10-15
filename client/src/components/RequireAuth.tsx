import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { AuthState } from '../hooks/useAuth';

export function RequireAuth({ auth }: { auth: AuthState }) {
  const location = useLocation();
  if (auth.loading) return <p role="status">Đang kiểm tra đăng nhập…</p>;
  if (!auth.user) {
    const from = location.pathname + location.search + location.hash;
    return <Navigate to="/dang-nhap" replace state={{ from }} />;
  }
  return <Outlet />;
}
