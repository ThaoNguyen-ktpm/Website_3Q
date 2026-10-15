import { Link, useNavigate } from 'react-router-dom';
import type { AuthState } from '../hooks/useAuth';

export function Header({ auth }: { auth: AuthState }) {
  const navigate = useNavigate();
  return (
    <header className="site-header">
      <Link to="/" className="brand">BaoQLuxury</Link>
      <div>
        {auth.loading ? <span>Đang tải…</span> : auth.user ? <>
          <span>{auth.user.email} </span>
          <button type="button" onClick={async () => {
            if (await auth.signOut()) navigate('/dang-nhap', { replace: true });
          }}>Đăng xuất</button>
        </> : <Link to="/dang-nhap">Đăng nhập</Link>}
        {auth.error && <p role="alert">{auth.error}</p>}
      </div>
    </header>
  );
}
