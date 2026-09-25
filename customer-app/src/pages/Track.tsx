import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Empty, TopBar } from '../components/ui';
import { api, rupees, type Driver, type Order, type OrderStatus, type Store } from '../lib/api';
import { getSocket } from '../lib/socket';

interface Detail {
  order: Order;
  store: Store;
  driver: Driver | null;
}

const STEPS: { status: OrderStatus; label: string; at: keyof Order }[] = [
  { status: 'placed', label: 'Order placed', at: 'placed_at' },
  { status: 'store_confirmed', label: 'Shop confirmed', at: 'store_confirmed_at' },
  { status: 'picked_up', label: 'Picked up', at: 'picked_up_at' },
  { status: 'on_the_way', label: 'On the way', at: 'on_the_way_at' },
  { status: 'delivered', label: 'Delivered', at: 'delivered_at' },
];

const HEADLINE: Record<OrderStatus, string> = {
  placed: 'Waiting for the shop to confirm',
  store_confirmed: 'The shop is packing your order',
  picked_up: 'Your rider has the order',
  on_the_way: 'On the way to you',
  delivered: 'Delivered',
  cancelled: 'Order cancelled',
};

function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export default function Track() {
  const { id } = useParams();
  const [data, setData] = useState<Detail | null>(null);
  const [driverPos, setDriverPos] = useState<[number, number] | null>(null);
  const [error, setError] = useState('');
  const now = useNow();

  useEffect(() => {
    let live = true;
    const load = () =>
      api<Detail>(`/orders/${id}`)
        .then((d) => {
          if (!live) return;
          setData(d);
          if (d.driver) setDriverPos((p) => p ?? [d.driver!.geo_lat, d.driver!.geo_lng]);
        })
        .catch((e) => setError(e.message));
    void load();

    const s = getSocket();
    const watch = () => s.emit('order:watch', id);
    watch();
    s.on('connect', watch); // re-join after reconnect
    const onUpdate = (o: Order) => {
      if (o.id !== id) return;
      // Driver details arrive with the order that first carries a driver_id.
      setData((d) => (d && !d.driver && o.driver_id ? (void load(), d) : d ? { ...d, order: o } : d));
    };
    const onLoc = (m: { order_id: string; lat: number; lng: number }) => m.order_id === id && setDriverPos([m.lat, m.lng]);
    s.on('order:update', onUpdate);
    s.on('driver:location', onLoc);
    return () => {
      live = false;
      s.emit('order:unwatch', id);
      s.off('connect', watch);
      s.off('order:update', onUpdate);
      s.off('driver:location', onLoc);
    };
  }, [id]);

  if (error) return <main className="page"><TopBar title="Track order" /><Empty title={error} /></main>;
  if (!data) return <main className="page"><TopBar title="Track order" /></main>;

  const { order, store, driver } = data;
  const cancelled = order.status === 'cancelled';
  const stepIndex = STEPS.findIndex((s) => s.status === order.status);
  const etaMs = order.eta ? new Date(order.eta).getTime() - now : 0;
  const respondMs = new Date(order.store_respond_by).getTime() - now;

  async function cancel() {
    try {
      const o = await api<Order>(`/orders/${order.id}/cancel`, { method: 'POST' });
      setData((d) => d && { ...d, order: o });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <main className="page track">
      <TopBar title={`Order ${order.code}`} />

      <section className={`track-hero ${cancelled ? 'is-cancelled' : ''} ${order.status === 'delivered' ? 'is-done' : ''}`}>
        <h2>{HEADLINE[order.status]}</h2>
        {order.status === 'placed' && <p>{store.name} has {fmtClock(respondMs)} to confirm your items are in stock.</p>}
        {['store_confirmed', 'picked_up', 'on_the_way'].includes(order.status) && order.eta && (
          <p className="eta">
            <b>{etaMs > 60_000 ? `${Math.ceil(etaMs / 60_000)} min` : etaMs > 0 ? 'Under a minute' : 'Any moment now'}</b>
            <span>Arriving around {fmtTime(order.eta)}</span>
          </p>
        )}
        {order.status === 'delivered' && order.delivered_at && <p>Delivered at {fmtTime(order.delivered_at)}.</p>}
        {cancelled && <p>{order.cancel_reason}{order.payment_status === 'refunded' ? ` · ${rupees(order.total)} refunded to your ${order.payment_method.toUpperCase()}` : ''}</p>}
      </section>

      {!cancelled && order.status !== 'delivered' && (
        <TrackMap store={store} order={order} driverPos={driverPos} />
      )}

      {driver && !cancelled && (
        <section className="block driver">
          <span className="avatar" aria-hidden>{driver.name[0]}</span>
          <div>
            <b>{driver.name}</b>
            <small>{driver.vehicle}</small>
          </div>
          <a className="ghost small-btn" href={`tel:${driver.phone}`}>Call</a>
        </section>
      )}

      {!cancelled && (
        <section className="block">
          <ol className="timeline">
            {STEPS.map((s, i) => {
              const at = order[s.at] as string | null;
              const state = i < stepIndex || order.status === 'delivered' ? 'done' : i === stepIndex ? 'now' : 'todo';
              return (
                <li key={s.status} className={state}>
                  <span className="dot" aria-hidden />
                  <span className="t-label">{s.label}</span>
                  {at && <time dateTime={at}>{fmtTime(at)}</time>}
                </li>
              );
            })}
          </ol>
          {order.status === 'store_confirmed' && (
            <p className="muted small">{order.ready_at ? 'Packed and waiting for the rider.' : 'The shop is packing your items.'}</p>
          )}
        </section>
      )}

      <section className="block">
        <h2>{store.name}</h2>
        {order.items.map((i) => (
          <div className="bill-row" key={i.product_id}>
            <span>{i.qty} × {i.name}</span>
            <span>{rupees(i.qty * i.price)}</span>
          </div>
        ))}
        <div className="bill-row total"><span>Paid by {order.payment_method.toUpperCase()}</span><span>{rupees(order.total)}</span></div>
        <p className="muted small">To {order.delivery_address.label}: {order.delivery_address.line1}, {order.delivery_address.area}</p>
      </section>

      {order.status === 'placed' && (
        <button className="ghost danger wide" onClick={cancel}>Cancel order</button>
      )}
      {(order.status === 'delivered' || cancelled) && (
        <Link to="/orders" className="ghost wide">See all orders</Link>
      )}
    </main>
  );
}

/** Schematic map (stand-in for Google Maps): shop, rider and home projected into a box. */
function TrackMap({ store, order, driverPos }: { store: Store; order: Order; driverPos: [number, number] | null }) {
  const home: [number, number] = [order.delivery_address.geo_lat, order.delivery_address.geo_lng];
  const shop: [number, number] = [store.geo_lat, store.geo_lng];
  const pts = [home, shop, ...(driverPos ? [driverPos] : [])];
  const lats = pts.map((p) => p[0]);
  const lngs = pts.map((p) => p[1]);
  const pad = 0.004;
  const [minLat, maxLat] = [Math.min(...lats) - pad, Math.max(...lats) + pad];
  const [minLng, maxLng] = [Math.min(...lngs) - pad, Math.max(...lngs) + pad];
  const W = 340;
  const H = 200;
  const xy = ([lat, lng]: [number, number]) => [((lng - minLng) / (maxLng - minLng)) * W, H - ((lat - minLat) / (maxLat - minLat)) * H];
  const [hx, hy] = xy(home);
  const [sx, sy] = xy(shop);
  const d = driverPos ? xy(driverPos) : null;

  return (
    <figure className="map" aria-label="Rider location">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="streets" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
            <path d="M0 14h28M14 0v28" stroke="var(--map-street)" strokeWidth="3" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#streets)" />
        <line x1={sx} y1={sy} x2={hx} y2={hy} stroke="var(--ink)" strokeWidth="2.5" strokeDasharray="6 5" opacity=".5" />
        <g transform={`translate(${sx} ${sy})`}>
          <rect x="-11" y="-11" width="22" height="22" rx="5" fill="var(--ink)" />
          <text y="5" textAnchor="middle" fontSize="13">🏪</text>
        </g>
        <g transform={`translate(${hx} ${hy})`}>
          <circle r="12" fill="var(--leaf)" />
          <text y="5" textAnchor="middle" fontSize="13">🏠</text>
        </g>
        {d && (
          <g className="rider" style={{ transform: `translate(${d[0]}px, ${d[1]}px)` }}>
            <circle r="16" fill="var(--marigold)" opacity=".3" className="pulse" />
            <circle r="11" fill="var(--marigold)" />
            <text y="5" textAnchor="middle" fontSize="12">🛵</text>
          </g>
        )}
      </svg>
      <figcaption className="muted small">{d ? 'Rider location updates live.' : 'A rider is assigned as soon as the shop confirms.'}</figcaption>
    </figure>
  );
}
