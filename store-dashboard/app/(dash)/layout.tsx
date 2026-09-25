'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, closeSocket, getToken, setToken, type Store } from '@/lib/api';
import { StoreCtx } from '@/lib/storeContext';

const NAV = [
  { href: '/orders', label: 'Orders' },
  { href: '/products', label: 'Products' },
  { href: '/earnings', label: 'Earnings' },
];

export default function DashLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) return router.replace('/login');
    api<Store>('/store/me')
      .then(setStore)
      .catch((e) => {
        if (e.status === 401) {
          setToken(null);
          router.replace('/login');
        } else setError(e.message);
      });
  }, [router]);

  async function toggleOpen() {
    if (!store) return;
    setStore(await api<Store>('/store/me', { method: 'PATCH', body: { is_open: !store.is_open } }));
  }

  if (error) return <main className="center-msg"><p className="error">{error}</p></main>;
  if (!store) return <main className="center-msg"><p>Loading your shop…</p></main>;

  return (
    <StoreCtx.Provider value={{ store, setStore }}>
      <div className="dash">
        <header className="dash-head">
          <span className="logo small">Movigo <em>Local</em></span>
          <span className="signboard">{store.name}</span>
          <nav aria-label="Dashboard">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={path.startsWith(n.href) ? 'on' : ''}>
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            className={`open-toggle ${store.is_open ? 'is-open' : ''}`}
            role="switch"
            aria-checked={store.is_open}
            onClick={toggleOpen}
          >
            <span className="knob" aria-hidden />
            {store.is_open ? 'Taking orders' : 'Shop closed'}
          </button>
          <button
            className="btn link"
            onClick={() => {
              setToken(null);
              closeSocket();
              router.replace('/login');
            }}
          >
            Log out
          </button>
        </header>
        <main className="dash-main">{children}</main>
      </div>
    </StoreCtx.Provider>
  );
}
