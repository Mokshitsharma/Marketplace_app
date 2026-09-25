import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Product, type Store } from '../lib/api';
import { useApp } from '../lib/state';
import { AddButton, Empty, Price, ProductArt, ProductCard, SlaStamp, TopBar } from '../components/ui';

interface Detail {
  product: Product;
  store: Store;
  more_from_store: Product[];
}

export default function ProductPage() {
  const { id } = useParams();
  const { config } = useApp();
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    api<Detail>(`/products/${id}`).then(setData).catch((e) => setError(e.message));
    scrollTo(0, 0);
  }, [id]);

  if (error) return <main className="page"><TopBar title="" /><Empty title={error} /></main>;
  if (!data) return <main className="page"><TopBar title="" /><div className="art art-lg skeleton" /></main>;

  const { store } = data;
  const withStore = (p: Product): Product => ({ ...p, store_name: store.name, store_area: store.area, store_open: store.is_open });
  const product = withStore(data.product);
  const off = product.mrp && product.mrp > product.price ? Math.round((1 - product.price / product.mrp) * 100) : 0;

  return (
    <main className="page product-page">
      <TopBar title="" />
      <ProductArt product={product} size="lg" />
      <div className="pd-body">
        <Link to={`/store/${store.id}`} className="signboard">{store.name}</Link>
        <h1>{product.name}</h1>
        <p className="muted">{product.unit}</p>
        <div className="pd-price">
          <Price price={product.price} mrp={product.mrp} />
          {off > 0 && <span className="off">{off}% off</span>}
        </div>
        <p className={product.stock_qty > 0 ? 'stock in' : 'stock out'}>
          {product.stock_qty > 5 ? 'In stock' : product.stock_qty > 0 ? `Only ${product.stock_qty} left` : 'Out of stock right now'}
        </p>
        {product.description && <p className="pd-desc">{product.description}</p>}
        <div className="pd-store">
          <SlaStamp minutes={config?.sla_minutes} />
          <p>
            Packed by <b>{store.name}</b>, {store.area}. A Movigo rider picks it up once the shop confirms it’s on the shelf.
          </p>
        </div>
      </div>

      {data.more_from_store.length > 0 && (
        <section>
          <h2 className="section-title">More from this shop</h2>
          <div className="grid">{data.more_from_store.map((p) => <ProductCard key={p.id} product={withStore(p)} />)}</div>
        </section>
      )}

      <div className="pd-cta">
        <AddButton product={product} wide />
      </div>
    </main>
  );
}
