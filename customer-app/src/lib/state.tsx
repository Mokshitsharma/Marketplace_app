import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type AppConfig, type Customer, type Product } from './api';
import { closeSocket } from './socket';

export interface CartLine {
  product: Product;
  qty: number;
}

interface Cart {
  storeId: string | null;
  storeName: string | null;
  lines: CartLine[];
}

interface AppState {
  config: AppConfig | null;
  me: Customer | null;
  loggedIn: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;

  cart: Cart;
  cartCount: number;
  subtotal: number;
  qtyOf: (productId: string) => number;
  /** Returns false when the product is from a different store than the cart. */
  add: (p: Product) => boolean;
  setQty: (productId: string, qty: number) => void;
  replaceCartWith: (p: Product) => void;
  /** Replace the whole cart in one go (used by reorder). */
  fillCart: (storeId: string, storeName: string, lines: CartLine[]) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  /** Product waiting on the "start a new cart?" decision. */
  conflict: Product | null;
  setConflict: (p: Product | null) => void;
}

const Ctx = createContext<AppState | null>(null);
const CART_KEY = 'movigo.customer.cart';
const EMPTY: Cart = { storeId: null, storeName: null, lines: [] };

function loadCart(): Cart {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as Cart) : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [me, setMe] = useState<Customer | null>(null);
  const [loggedIn, setLoggedIn] = useState(!!getToken());
  const [cart, setCart] = useState<Cart>(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [conflict, setConflict] = useState<Product | null>(null);

  useEffect(() => {
    api<AppConfig>('/config').then(setConfig).catch(() => {});
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      setMe(await api<Customer>('/me'));
    } catch (e) {
      if ((e as { status?: number }).status === 401) {
        setToken(null);
        setLoggedIn(false);
      }
    }
  }, []);

  useEffect(() => {
    if (loggedIn) void refreshMe();
  }, [loggedIn, refreshMe]);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      /* ignore */
    }
  }, [cart]);

  const value = useMemo<AppState>(() => {
    const qtyOf = (id: string) => cart.lines.find((l) => l.product.id === id)?.qty ?? 0;
    const setQty = (id: string, qty: number) =>
      setCart((c) => {
        const lines = c.lines
          .map((l) => (l.product.id === id ? { ...l, qty: Math.min(qty, l.product.stock_qty) } : l))
          .filter((l) => l.qty > 0);
        return lines.length ? { ...c, lines } : EMPTY;
      });
    return {
      config,
      me,
      loggedIn,
      login: async (token) => {
        setToken(token);
        closeSocket();
        setLoggedIn(true);
      },
      logout: () => {
        setToken(null);
        closeSocket();
        setLoggedIn(false);
        setMe(null);
      },
      refreshMe,
      cart,
      cartCount: cart.lines.reduce((s, l) => s + l.qty, 0),
      subtotal: cart.lines.reduce((s, l) => s + l.qty * l.product.price, 0),
      qtyOf,
      add: (p) => {
        if (cart.storeId && cart.storeId !== p.store_id) return false;
        const current = qtyOf(p.id);
        if (current >= p.stock_qty) return true;
        setCart((c) => ({
          storeId: p.store_id,
          storeName: p.store_name ?? c.storeName,
          lines: current ? c.lines.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l)) : [...c.lines, { product: p, qty: 1 }],
        }));
        return true;
      },
      setQty,
      replaceCartWith: (p) => setCart({ storeId: p.store_id, storeName: p.store_name ?? null, lines: [{ product: p, qty: 1 }] }),
      fillCart: (storeId, storeName, lines) => setCart({ storeId, storeName, lines }),
      clearCart: () => setCart(EMPTY),
      cartOpen,
      setCartOpen,
      conflict,
      setConflict,
    };
  }, [config, me, loggedIn, refreshMe, cart, cartOpen, conflict]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
