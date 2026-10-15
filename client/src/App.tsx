import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { RequireAuth } from './components/RequireAuth';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { LoginPage } from './pages/LoginPage';
import { useAuth } from './hooks/useAuth';

export function App() {
  return <BrowserRouter><SiteRoutes /></BrowserRouter>;
}

function SiteRoutes() {
  const auth = useAuth();
  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage auth={auth} />} />
      <Route element={<RequireAuth auth={auth} />}>
        <Route element={<><Header auth={auth} /><Outlet /></>}>
          <Route path="/" element={<HomePage onSessionExpired={auth.expireSession} />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
