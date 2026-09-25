'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, fmtTime, getSocket, rupees, type Order } from '@/lib/api';

const PAST_LABEL: Record<string, string> = {
  picked_up: 'Picked up',
  on_the_way: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

/** Short two-tone chime for new orders (browsers allow it after the first click on the page). */
function chime() {
  try {
    const ctx = new AudioContext();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.15, ctx.currentTime + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.18);
      o.stop(ctx.currentTime + i * 0.18 + 0.3);
    });
  } catch {
    /* audio unavailable */
  }
}

export default function OrdersPage() {
  const [active, setActive] = useState<Order[] | null>(null);
  const [past, setPast] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const known = useRef<Set<string> | null>(null);
  const now = useNow();

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([api<Order[]>('/store/orders?scope=active'), api<Order[]>('/store/orders?scope=past')]);
      const fresh = a.filter((o) => o.status === 'placed' && known.current && !known.current.has(o.id));
      if (fresh.length) chime();
      known.current = new Set(a.map((o) => o.id));
      setActive(a);
      setPast(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
    const s = getSocket();
    s.on('order:update', load);
    s.on('connect', load);
    return () => {
      s.off('order:update', load);
      s.off('connect', load);
    };
  }, [load]);

  const incoming = active?.filter((o) => o.status === 'placed') ?? [];
  const packing = active?.filter((o) => o.status === 'store_confirmed') ?? [];

  useEffect(() => {
    document.title = incoming.length ? `(${incoming.length}) New order · Movigo Local` : 'Orders · Movigo Local';
  }, [incoming.length]);

  async function act(o: Order, action: 'accept' | 'reject' | 'ready', body?: unknown) {
    setBusyId(o.id);
    setError('');
    try {
      await api(`/store/orders/${o.id}/${action}`, { method: 'POST', body: body ?? {} });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="orders">
      {error && <p className="error banner-error" role="alert">{error}</p>}

      <section className="lane lane-new">
        <h2>New orders <span className="count">{incoming.length}</span></h2>
        <p className="lane-hint">Check the shelf, then accept. Orders cancel automatically if you don’t respond in time.</p>
        {active && !incoming.length && <p className="lane-empty">No new orders. Keep this tab open and you’ll hear a chime when one arrives.</p>}
        {incoming.map((o) => {
          const total = new Date(o.store_respond_by).getTime() - new Date(o.placed_at).getTime();
          const left = Math.max(0, new Date(o.store_respond_by).getTime() - now);
          const pct = total > 0 ? left / total : 0;
          return (
            <article key={o.id} className={`ocard incoming ${pct < 0.3 ? 'urgent' : ''}`}>
              <div className="timer" style={{ ['--pct' as string]: pct }} aria-label={`${Math.ceil(left / 1000)} seconds left to respond`}>
                <span>{Math.floor(left / 60000)}:{String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}</span>
              </div>
              <OrderBody o={o} />
              <div className="actions">
                <button className="btn primary" disabled={busyId === o.id || left <= 0} onClick={() => act(o, 'accept')}>
                  Accept order
                </button>
                <button
                  className="btn ghost danger"
                  disabled={busyId === o.id}
                  onClick={() => {
                    const reason = prompt('Why can’t you fulfil this order? The customer will see this.', 'Item out of stock');
                    if (reason !== null) void act(o, 'reject', { reason });
                  }}
                >
                  Reject
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="lane">
        <h2>Packing <span className="count">{packing.length}</span></h2>
        <p className="lane-hint">Mark an order ready once it’s packed. The rider collects it after that.</p>
        {active && !packing.length && <p className="lane-empty">Accepted orders show up here while you pack them.</p>}
        {packing.map((o) => (
          <article key={o.id} className="ocard">
            <OrderBody o={o} />
            <p className="rider">
              {o.driver ? (
                <>Rider <b>{o.driver.name}</b>, {o.driver.vehicle}{o.ready_at ? ', on the way to collect' : ''}</>
              ) : (
                'Finding a rider…'
              )}
            </p>
            <div className="actions">
              {o.ready_at ? (
                <span className="tag ok">Ready since {fmtTime(o.ready_at)}</span>
              ) : (
                <button className="btn primary" disabled={busyId === o.id} onClick={() => act(o, 'ready')}>
                  Mark ready for pickup
                </button>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className="lane lane-past">
        <h2>Earlier today and before</h2>
        {!past.length && <p className="lane-empty">Orders that have left your shop will be listed here.</p>}
        {past.length > 0 && (
        <table className="past">
          <thead>
            <tr><th>Order</th><th>Items</th><th>Placed</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {past.map((o) => (
              <tr key={o.id}>
                <td>{o.code}</td>
                <td>{o.items.map((i) => `${i.qty} × ${i.name}`).join(', ')}</td>
                <td>{new Date(o.placed_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</td>
                <td>{rupees(o.subtotal)}</td>
                <td>
                  <span className={`tag s-${o.status}`} title={o.cancel_reason ?? undefined}>{PAST_LABEL[o.status]}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </section>
    </div>
  );
}

function OrderBody({ o }: { o: Order }) {
  return (
    <div className="obody">
      <header>
        <b>{o.code}</b>
        <span className="muted">Placed {fmtTime(o.placed_at)}</span>
      </header>
      <ul>
        {o.items.map((i) => (
          <li key={i.product_id}>
            <span className="qty">{i.qty}×</span> {i.name}
            <span className="amt">{rupees(i.qty * i.price)}</span>
          </li>
        ))}
      </ul>
      <footer>
        <span>To {o.delivery_address.area}</span>
        <b>{rupees(o.subtotal)}</b>
      </footer>
    </div>
  );
}
