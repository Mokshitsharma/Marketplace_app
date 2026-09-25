import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AddressForm } from '../components/AddressForm';
import { ProductArt, SlaStamp, TopBar } from '../components/ui';
import { api, rupees, type Order } from '../lib/api';
import { useApp } from '../lib/state';

export default function Checkout() {
  const { cart, subtotal, config, me, refreshMe, clearCart } = useApp();
  const nav = useNavigate();
  const [addressId, setAddressId] = useState('');
  const [adding, setAdding] = useState(false);
  const [method, setMethod] = useState<'upi' | 'card' | 'cod'>('upi');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me && !addressId && me.saved_addresses[0]) setAddressId(me.saved_addresses[0].id);
    if (me && !me.saved_addresses.length) setAdding(true);
  }, [me, addressId]);

  if (!cart.lines.length && !busy) return <Navigate to="/" replace />;

  const deliveryFee = config && subtotal >= config.free_delivery_above ? 0 : config?.delivery_fee ?? 0;
  const platformFee = config?.platform_fee ?? 0;
  const total = subtotal + deliveryFee + platformFee;

  async function place() {
    setBusy(true);
    setError('');
    try {
      const order = await api<Order>('/orders', {
        body: {
          store_id: cart.storeId,
          items: cart.lines.map((l) => ({ product_id: l.product.id, qty: l.qty })),
          address_id: addressId,
          payment_method: method,
        },
      });
      clearCart();
      nav(`/track/${order.id}`, { replace: true });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="page checkout">
      <TopBar title="Checkout" />

      <section className="block">
        <h2>Deliver to</h2>
        {me?.saved_addresses.map((a) => (
          <label key={a.id} className={`radio-card ${addressId === a.id ? 'on' : ''}`}>
            <input type="radio" name="addr" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
            <span>
              <b>{a.label}</b>
              <small>{a.line1}, {a.area}</small>
            </span>
          </label>
        ))}
        {adding ? (
          <AddressForm
            onSaved={async (c) => {
              await refreshMe();
              setAddressId(c.saved_addresses[c.saved_addresses.length - 1].id);
              setAdding(false);
            }}
          />
        ) : (
          <button className="linkbtn" onClick={() => setAdding(true)}>Add a new address</button>
        )}
      </section>

      <section className="block slot">
        <SlaStamp minutes={config?.sla_minutes} />
        <div>
          <h2>As soon as possible</h2>
          <p className="muted small">The shop confirms stock first, then a Movigo rider picks it up.</p>
        </div>
      </section>

      <section className="block">
        <h2>Pay with</h2>
        {config?.payment_methods.map((m) => (
          <label key={m.id} className={`radio-card ${method === m.id ? 'on' : ''}`}>
            <input type="radio" name="pay" checked={method === m.id} onChange={() => setMethod(m.id)} />
            <span>
              <b>{m.label}</b>
              <small>{m.hint}</small>
            </span>
          </label>
        ))}
        <p className="demo-note">Demo build: payments are simulated. No money moves.</p>
      </section>

      <section className="block">
        <h2>Order summary</h2>
        <p className="muted small">From {cart.storeName}</p>
        {cart.lines.map(({ product, qty }) => (
          <div className="line" key={product.id}>
            <ProductArt product={product} size="sm" />
            <div className="line-main">
              <b>{product.name}</b>
              <span className="muted small">{qty} × {rupees(product.price)}</span>
            </div>
            <b className="line-amt">{rupees(product.price * qty)}</b>
          </div>
        ))}
        <dl className="bill">
          <div><dt>Items</dt><dd>{rupees(subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd>{deliveryFee ? rupees(deliveryFee) : <span className="free">Free</span>}</dd></div>
          <div><dt>Platform fee</dt><dd>{rupees(platformFee)}</dd></div>
          <div className="bill-total"><dt>To pay</dt><dd>{rupees(total)}</dd></div>
        </dl>
      </section>

      <div className="sticky-cta">
        {error && <p className="error" role="alert">{error}</p>}
        <button className="cta" disabled={busy || !addressId} onClick={place}>
          {busy ? 'Placing order…' : `Place order · ${rupees(total)}`}
        </button>
      </div>
    </main>
  );
}
