import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AuthState } from '../hooks/useAuth';

const AdminApp = lazy(() => import('../admin/views/App.jsx'));

export function AdminPage({ auth }: { auth: AuthState }) {
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (await auth.signOut()) navigate('/dang-nhap', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="admin-page">
      <Suspense fallback={<p role="status">Đang tải trang quản trị…</p>}>
        <AdminApp user={auth.user!} onSignOut={onSignOut}
          signingOut={signingOut} signOutError={auth.error} />
      </Suspense>
    </div>
  );
}
