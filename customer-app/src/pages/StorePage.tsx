import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Product, type Store } from '../lib/api';
import { Empty, ProductCard, TopBar } from '../components/ui';

export default function StorePage() {
  const { id } = useParams();
  const [data, setData] = useState<{ store: Store; products: Product[] } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ store: Store; products: Product[] }>(`/stores/${id}`).then(setData).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <main className="page"><TopBar title="" /><Empty title={error} /></main>;
  if (!data) return <main className="page"><TopBar title="" /></main>;
  const { store, products } = data;

  return (
    <main className="page">
      <TopBar title="" />
      <header className="store-head">
        <span className="signboard big">{store.name}</span>
        <p className="muted">{store.address}</p>
        {!store.is_open && <p className="error">This shop is closed right now. You can browse, but can’t order.</p>}
      </header>
      <div className="grid">
        {products.map((p) => (
          <ProductCard key={p.id} product={{ ...p, store_name: store.name, store_open: store.is_open }} />
        ))}
      </div>
    </main>
  );
}
