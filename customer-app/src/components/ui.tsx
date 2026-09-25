import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { rupees, type Product } from '../lib/api';
import { useApp } from '../lib/state';

// ---------- product art ----------

// Stick to emoji from Unicode 12 or earlier: Windows 10 has no glyphs for newer ones.
const EMOJI: [RegExp, string][] = [
  [/lamp|led|batten/i, '💡'],
  [/table|desk/i, '🛋️'],
  [/stool|moodha|chair/i, '🪑'],
  [/shelf|rack|drawer/i, '🗄️'],
  [/clock/i, '🕰️'],
  [/diya/i, '🪔'],
  [/rug|mat/i, '🧶'],
  [/cushion|bedsheet|net/i, '🛏️'],
  [/plant|planter/i, '🌿'],
  [/cooker|kadhai|tawa|thali|masala/i, '🍳'],
  [/bottle/i, '🥤'],
  [/drying|iron/i, '👕'],
  [/drill/i, '🛠️'],
  [/screwdriver|ladder/i, '🔧'],
  [/tap/i, '🚰'],
  [/extension|socket/i, '🔌'],
];

const TINT: Record<string, string> = { furniture: 'var(--tint-wood)', home: 'var(--tint-home)', hardware: 'var(--tint-tool)' };

export function ProductArt({ product, size = 'md' }: { product: Product; size?: 'sm' | 'md' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  const src = product.image_urls[0];
  const emoji = EMOJI.find(([re]) => re.test(product.name))?.[1] ?? '📦';
  return (
    <div className={`art art-${size}`} style={{ background: TINT[product.category] ?? 'var(--tint-home)' }}>
      {src && !broken ? <img src={src} alt="" onError={() => setBroken(true)} /> : <span aria-hidden>{emoji}</span>}
    </div>
  );
}

// ---------- add / stepper ----------

export function AddButton({ product, wide = false }: { product: Product; wide?: boolean }) {
  const { qtyOf, add, setQty, setConflict } = useApp();
  const qty = qtyOf(product.id);
  if (product.stock_qty <= 0) return <span className={`add add-out ${wide ? 'wide' : ''}`}>Out of stock</span>;
  if (product.store_open === false) return <span className={`add add-out ${wide ? 'wide' : ''}`}>Store closed</span>;
  if (!qty)
    return (
      <button className={`add ${wide ? 'wide' : ''}`} onClick={() => add(product) || setConflict(product)}>
        Add
      </button>
    );
  return (
    <div className={`stepper ${wide ? 'wide' : ''}`} role="group" aria-label={`Quantity of ${product.name}`}>
      <button onClick={() => setQty(product.id, qty - 1)} aria-label="Remove one">−</button>
      <span aria-live="polite">{qty}</span>
      <button onClick={() => add(product)} disabled={qty >= product.stock_qty} aria-label="Add one">+</button>
    </div>
  );
}

// ---------- cards ----------

export function Price({ price, mrp }: { price: number; mrp: number | null }) {
  return (
    <span className="price">
      <b>{rupees(price)}</b>
      {mrp && mrp > price ? <s>{rupees(mrp)}</s> : null}
    </span>
  );
}

export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="pcard">
      <Link to={`/product/${product.id}`} className="pcard-link">
        <ProductArt product={product} />
        {product.store_name && <span className="signboard">{product.store_name}</span>}
        <h3>{product.name}</h3>
        <p className="muted small">{product.unit}{product.stock_qty > 0 && product.stock_qty <= 3 ? ` · only ${product.stock_qty} left` : ''}</p>
      </Link>
      <div className="pcard-foot">
        <Price price={product.price} mrp={product.mrp} />
        <AddButton product={product} />
      </div>
    </article>
  );
}

export function SlaStamp({ minutes = 30 }: { minutes?: number }) {
  return (
    <span className="stamp" title={`Delivered in about ${minutes} minutes`}>
      <b>{minutes}</b>
      <small>min</small>
    </span>
  );
}

// ---------- chrome ----------

export function BottomNav() {
  const tabs = [
    { to: '/', label: 'Home', icon: '⌂' },
    { to: '/search', label: 'Search', icon: '⌕' },
    { to: '/orders', label: 'Orders', icon: '☰' },
    { to: '/profile', label: 'Profile', icon: '◉' },
  ];
  return (
    <nav className="bottomnav" aria-label="Main">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === '/'}>
          <span aria-hidden className="ico">{t.icon}</span>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function TopBar({ title, back = true }: { title: string; back?: boolean }) {
  const nav = useNavigate();
  return (
    <header className="topbar">
      {back && (
        <button className="iconbtn" onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} aria-label="Back">
          ←
        </button>
      )}
      <h1>{title}</h1>
    </header>
  );
}

/** Sticky cart summary that sits above the bottom nav. */
export function CartBar() {
  const { cartCount, subtotal, cart, setCartOpen } = useApp();
  if (!cartCount) return null;
  return (
    <button className="cartbar" onClick={() => setCartOpen(true)}>
      <span>
        <b>{cartCount} {cartCount === 1 ? 'item' : 'items'}</b> · {rupees(subtotal)}
        <small>from {cart.storeName}</small>
      </span>
      <span className="cartbar-cta">View cart</span>
    </button>
  );
}

export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: React.ReactNode; label: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" aria-hidden />
        {children}
      </div>
    </div>
  );
}

export function CartSheet() {
  const { cartOpen, setCartOpen, cart, setQty, subtotal, config, loggedIn } = useApp();
  const nav = useNavigate();
  const deliveryFee = config && subtotal >= config.free_delivery_above ? 0 : config?.delivery_fee ?? 0;
  const platformFee = config?.platform_fee ?? 0;
  const close = () => setCartOpen(false);
  return (
    <Sheet open={cartOpen} onClose={close} label="Your cart">
      <div className="sheet-head">
        <h2>Your cart</h2>
        <p className="muted">From {cart.storeName}</p>
      </div>
      {cart.lines.map(({ product, qty }) => (
        <div className="line" key={product.id}>
          <ProductArt product={product} size="sm" />
          <div className="line-main">
            <b>{product.name}</b>
            <span className="muted small">{product.unit}</span>
          </div>
          <div className="stepper">
            <button onClick={() => setQty(product.id, qty - 1)} aria-label={`Remove one ${product.name}`}>−</button>
            <span>{qty}</span>
            <button onClick={() => setQty(product.id, qty + 1)} disabled={qty >= product.stock_qty} aria-label={`Add one ${product.name}`}>+</button>
          </div>
          <b className="line-amt">{rupees(product.price * qty)}</b>
        </div>
      ))}
      <dl className="bill">
        <div><dt>Items</dt><dd>{rupees(subtotal)}</dd></div>
        <div>
          <dt>Delivery</dt>
          <dd>{deliveryFee ? rupees(deliveryFee) : <span className="free">Free</span>}</dd>
        </div>
        <div><dt>Platform fee</dt><dd>{rupees(platformFee)}</dd></div>
        <div className="bill-total"><dt>To pay</dt><dd>{rupees(subtotal + deliveryFee + platformFee)}</dd></div>
      </dl>
      {config && deliveryFee > 0 && (
        <p className="hint">Add {rupees(config.free_delivery_above - subtotal)} more for free delivery.</p>
      )}
      <button
        className="cta"
        onClick={() => {
          close();
          nav(loggedIn ? '/checkout' : '/login?next=/checkout');
        }}
      >
        Proceed to checkout
      </button>
    </Sheet>
  );
}

export function CartConflictDialog() {
  const { conflict, setConflict, cart, replaceCartWith } = useApp();
  return (
    <Sheet open={!!conflict} onClose={() => setConflict(null)} label="Start a new cart?">
      <div className="sheet-head">
        <h2>Start a new cart?</h2>
        <p className="muted">
          Each order comes from one store. Your cart has items from {cart.storeName}. Adding this will clear them.
        </p>
      </div>
      <div className="row-gap">
        <button className="ghost" onClick={() => setConflict(null)}>Keep current cart</button>
        <button
          className="cta"
          onClick={() => {
            if (conflict) replaceCartWith(conflict);
            setConflict(null);
          }}
        >
          Start new cart
        </button>
      </div>
    </Sheet>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function useDebounced<T>(value: T, ms = 200) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}
