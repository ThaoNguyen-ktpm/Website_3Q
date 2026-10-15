import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/700.css';
import { getAuthConfig, loginWithGoogle } from '../api/auth';
import type { AuthState } from '../hooks/useAuth';

type GoogleId = {
  initialize(options: { client_id: string; callback: (result: { credential: string }) => void }): void;
  renderButton(element: HTMLElement, options: {
    theme: 'outline'; shape: 'rectangular'; text: 'continue_with'; locale: 'vi'; size: 'large'; width: number;
  }): void;
};
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

// three.js is only needed here, so the 3D bag loads in its own chunk after the sign-in card.
const BirkinBag3D = lazy(() => import('../components/BirkinBag3D').then((m) => ({ default: m.BirkinBag3D })));

export function LoginPage({ auth }: { auth: AuthState }) {
  const { user, loading, setUser } = auth;
  const navigate = useNavigate();
  const location = useLocation();
  const from: unknown = location.state?.from;
  const destination = typeof from === 'string' && from.startsWith('/') &&
    !from.startsWith('//') && !from.includes('\\') &&
    !/^\/dang-nhap\/?(?:[?#]|$)/i.test(from) ? from : '/';
  const button = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading || user) return;
    const controller = new AbortController();
    let script: HTMLScriptElement | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    setError('');
    setReady(false);
    function render() {
      if (controller.signal.aborted) return;
      clearTimeout(timeout);
      const google = window.google?.accounts.id;
      if (!google || !button.current) {
        setError('Không thể tải đăng nhập Google. Vui lòng tải lại trang.');
        return;
      }
      google.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          if (controller.signal.aborted) return;
          setPending(true);
          setError('');
          try {
            const { user } = await loginWithGoogle(credential);
            if (!controller.signal.aborted) { setUser(user); navigate(destination, { replace: true }); }
          } catch (error) {
            if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Không thể đăng nhập.');
          } finally { if (!controller.signal.aborted) setPending(false); }
        },
      });
      google.renderButton(button.current, {
        theme: 'outline', shape: 'rectangular', text: 'continue_with', locale: 'vi', size: 'large',
        width: Math.min(320, button.current.clientWidth),
      });
      setReady(true);
    }
    let clientId = '';
    getAuthConfig(controller.signal).then((config) => {
      if (controller.signal.aborted) return;
      clientId = config.googleClientId;
      if (window.google?.accounts.id) { render(); return; }
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = render;
      const fail = () => {
        clearTimeout(timeout);
        if (!controller.signal.aborted) setError('Không thể tải đăng nhập Google. Vui lòng tải lại trang.');
      };
      script.onerror = fail;
      timeout = setTimeout(fail, 15000);
      document.head.appendChild(script);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Không thể tải cấu hình đăng nhập.');
    });
    return () => {
      controller.abort();
      clearTimeout(timeout);
      script?.remove();
      button.current?.replaceChildren();
    };
  }, [loading, user, setUser, navigate, destination]);

  if (loading) return <p role="status">Đang kiểm tra đăng nhập…</p>;
  if (user) return <Navigate to={destination} replace />;
  return (
    <main className="login-page">
      <video className="login-background" src="/login-background.mp4" autoPlay muted loop playsInline aria-hidden="true" preload="auto" />
      <div className="login-shade" aria-hidden="true" />
      <div className="login-layout">
        <div className="login-panel">
      <img className="login-logo" src="/brand/baoq-logo-transparent.png" alt="BaoQ Luxury — Buy · Sell · Consign" width="816" height="600" />
      <section className="login-card" aria-labelledby="login-title">
        <h1 id="login-title" className="login-title">Đăng nhập</h1>
        <p className="login-subtitle">Chỉ dành cho tài khoản đã được cấp quyền.</p>
        <div className="login-google" ref={button} inert={pending} aria-busy={pending} />
        {!ready && !error && <p className="login-status" role="status">Đang tải đăng nhập…</p>}
        {pending && <p className="login-status" role="status">Đang xác minh…</p>}
        {(error || auth.error) && <p className="login-error" role="alert">{error || auth.error}</p>}
        <p className="login-terms">Bằng việc tiếp tục, bạn đồng ý với điều khoản của BaoQ Luxury.</p>
      </section>
        </div>
        <div className="login-bag">
          <Suspense fallback={null}><BirkinBag3D /></Suspense>
        </div>
      </div>
    </main>
  );
}
