import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Empty } from '../components/ui';
import { api, rupees, type Order, type OrderStatus, type Product } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useApp } from '../lib/state';

const LABEL: Record<OrderStatus, string> = {
  placed: 'Waiting for shop',
  store_confirmed: 'Being packed',
  picked_up: 'Picked up',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState('');
  const { fillCart, setCartOpen } = useApp();
  const nav = useNavigate();

  useEffect(() => {
    const load = () => api<Order[]>('/orders').then(setOrders).catch((e) => setError(e.message));
    void load();
    const s = getSocket();
    s.on('order:update', load);
    return () => {
      s.off('order:update', load);
    };
  }, []);

  async function reorder(o: Order) {
    try {
      const { store, products } = await api<{ store: { name: string; is_open: boolean }; products: Product[] }>(`/stores/${o.store_id}`);
      const available = o.items
        .map((i) => ({ item: i, p: products.find((p) => p.id === i.product_id) }))
        .filter((x): x is { item: typeof x.item; p: Product } => !!x.p && x.p.stock_qty > 0);
      if (!available.length) return setError(`None of those items are in stock at ${store.name} right now.`);
      fillCart(
        o.store_id,
        store.name,
        available.map(({ item, p }) => ({ product: { ...p, store_name: store.name, store_open: store.is_open }, qty: Math.min(item.qty, p.stock_qty) })),
      );
      setCartOpen(true);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="page">
      <header className="topbar"><h1>Your orders</h1></header>
      {error && <p className="error" role="alert">{error}</p>}
      {orders && !orders.length && (
        <Empty title="No orders yet">
          <p>Your orders from local shops will show up here.</p>
          <button className="cta" onClick={() => nav('/')}>Start shopping</button>
        </Empty>
      )}
      <div className="order-list">
        {orders?.map((o) => (
          <article key={o.id} className="ocard">
            <Link to={`/track/${o.id}`} className="ocard-link">
              <div className="ocard-top">
                <b>{o.store_name}</b>
                <span className={`badge s-${o.status}`}>{LABEL[o.status]}</span>
              </div>
              <p className="muted small">
                {o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}
              </p>
              <p className="small">
                {new Date(o.placed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · {rupees(o.total)}
              </p>
            </Link>
            {(o.status === 'delivered' || o.status === 'cancelled') && (
              <button className="ghost small-btn" onClick={() => reorder(o)}>Reorder</button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
