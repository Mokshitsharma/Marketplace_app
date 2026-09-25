import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomNav, CartBar, CartConflictDialog, CartSheet } from './components/ui';
import { AppProvider, useApp } from './lib/state';
import Checkout from './pages/Checkout';
import Home from './pages/Home';
import Login from './pages/Login';
import Orders from './pages/Orders';
import ProductPage from './pages/ProductPage';
import Profile from './pages/Profile';
import Search from './pages/Search';
import StorePage from './pages/StorePage';
import Track from './pages/Track';
import './styles.css';

function RequireLogin({ children }: { children: ReactNode }) {
  const { loggedIn } = useApp();
  const loc = useLocation();
  return loggedIn ? children : <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
}

function Shell() {
  const loc = useLocation();
  const bare = ['/login', '/checkout'].includes(loc.pathname) || loc.pathname.startsWith('/track') || loc.pathname.startsWith('/product');
  return (
    <div className={`app ${bare ? '' : 'has-nav'}`}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/store/:id" element={<StorePage />} />
        <Route path="/checkout" element={<RequireLogin><Checkout /></RequireLogin>} />
        <Route path="/track/:id" element={<RequireLogin><Track /></RequireLogin>} />
        <Route path="/orders" element={<RequireLogin><Orders /></RequireLogin>} />
        <Route path="/profile" element={<RequireLogin><Profile /></RequireLogin>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!['/login', '/checkout'].includes(loc.pathname) && !loc.pathname.startsWith('/track') && <CartBar />}
      {!bare && <BottomNav />}
      <CartSheet />
      <CartConflictDialog />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AppProvider>
  </StrictMode>,
);
