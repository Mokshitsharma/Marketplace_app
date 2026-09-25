import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Product, type Store } from '../lib/api';
import { useApp } from '../lib/state';
import { Empty, ProductCard, SlaStamp } from '../components/ui';

export default function Home() {
  const { config, me } = useApp();
  const [category, setCategory] = useState('');
  const [products, setProducts] = useState<Product[] | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Store[]>('/stores').then(setStores).catch(() => {});
  }, []);

  useEffect(() => {
    setProducts(null);
    api<Product[]>(`/products${category ? `?category=${category}` : ''}`)
      .then(setProducts)
      .catch((e) => setError(e.message));
  }, [category]);

  const address = me?.saved_addresses[0];

  return (
    <main className="page">
      <header className="home-head">
        <Link to="/profile" className="locbar">
          <SlaStamp minutes={config?.sla_minutes} />
          <span>
            <b>Delivery in {config?.sla_minutes ?? 30} minutes</b>
            <small>{address ? `${address.label} · ${address.line1}, ${address.area}` : 'Add a delivery address'}</small>
          </span>
        </Link>
        <Link to="/search" className="searchbar" aria-label="Search">
          <span aria-hidden>⌕</span> Search for “study table” or “drill”
        </Link>
      </header>

      <div className="chips" role="tablist" aria-label="Categories">
        <button role="tab" aria-selected={!category} className={!category ? 'on' : ''} onClick={() => setCategory('')}>All</button>
        {config?.categories.map((c) => (
          <button role="tab" key={c.id} aria-selected={category === c.id} className={category === c.id ? 'on' : ''} onClick={() => setCategory(c.id)}>
            <span aria-hidden>{c.emoji}</span> {c.name}
          </button>
        ))}
      </div>

      <section className="banner">
        <div>
          <h2>The shop down the road, now on your phone.</h2>
          <p>Things quick-commerce apps don’t carry, from stores you already trust.</p>
        </div>
      </section>

      {!category && stores.length > 0 && (
        <section>
          <h2 className="section-title">Shops near you</h2>
          <div className="stores-row">
            {stores.map((s) => (
              <Link to={`/store/${s.id}`} key={s.id} className="store-tile">
                <span className="signboard">{s.name}</span>
                <small>{s.area}{s.is_open ? '' : ' · closed'}</small>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">{category ? config?.categories.find((c) => c.id === category)?.name : 'Fresh on the shelves'}</h2>
        {error && <Empty title="Couldn’t load products"><p>{error}</p></Empty>}
        {!products && !error && <div className="grid">{Array.from({ length: 6 }, (_, i) => <div key={i} className="pcard skeleton" />)}</div>}
        {products && (
          <div className="grid">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </main>
  );
}
