'use client';

import { useEffect, useState } from 'react';
import { api, CATEGORIES, rupees, type Product } from '@/lib/api';

type Draft = {
  name: string;
  description: string;
  image_url: string;
  price: string;
  mrp: string;
  unit: string;
  stock_qty: string;
  category: string;
  is_active: boolean;
};

const blank: Draft = { name: '', description: '', image_url: '', price: '', mrp: '', unit: '1 pc', stock_qty: '', category: 'furniture', is_active: true };

const toDraft = (p: Product): Draft => ({
  name: p.name,
  description: p.description,
  image_url: p.image_urls[0] ?? '',
  price: String(p.price),
  mrp: p.mrp ? String(p.mrp) : '',
  unit: p.unit,
  stock_qty: String(p.stock_qty),
  category: p.category,
  is_active: p.is_active,
});

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const load = () => api<Product[]>('/store/products').then(setProducts).catch((e) => setError(e.message));
  useEffect(() => {
    void load();
  }, []);

  async function patch(p: Product, body: Partial<Product>) {
    setProducts((ps) => ps?.map((x) => (x.id === p.id ? { ...x, ...body } : x)) ?? null);
    try {
      await api(`/store/products/${p.id}`, { method: 'PATCH', body });
    } catch (e) {
      setError((e as Error).message);
      void load();
    }
  }

  const shown = products?.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase())) ?? [];

  return (
    <div className="products">
      <div className="toolbar">
        <input type="search" placeholder="Find a product" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Find a product" />
        <button className="btn primary" onClick={() => setEditing('new')}>Add product</button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      {products && !products.length && <p className="lane-empty">No products yet. Add the first item customers can order from you.</p>}

      <table className="ptable">
        <thead>
          <tr><th>Product</th><th>Price</th><th>Stock</th><th>Listed</th><th /></tr>
        </thead>
        <tbody>
          {shown.map((p) => (
            <tr key={p.id} className={p.is_active ? '' : 'inactive'}>
              <td>
                <b>{p.name}</b>
                <small>{CATEGORIES.find((c) => c.id === p.category)?.name} · {p.unit}</small>
              </td>
              <td>{rupees(p.price)}{p.mrp ? <s> {rupees(p.mrp)}</s> : null}</td>
              <td>
                <div className="stock-edit">
                  <button onClick={() => patch(p, { stock_qty: Math.max(0, p.stock_qty - 1) })} aria-label={`One less ${p.name}`}>−</button>
                  <span className={p.stock_qty === 0 ? 'zero' : ''}>{p.stock_qty}</span>
                  <button onClick={() => patch(p, { stock_qty: p.stock_qty + 1 })} aria-label={`One more ${p.name}`}>+</button>
                </div>
              </td>
              <td>
                <button
                  role="switch"
                  aria-checked={p.is_active}
                  aria-label={`Show ${p.name} to customers`}
                  className={`switch ${p.is_active ? 'on' : ''}`}
                  onClick={() => patch(p, { is_active: !p.is_active })}
                >
                  <span className="knob" />
                </button>
              </td>
              <td><button className="btn link" onClick={() => setEditing(p)}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function ProductForm({ product, onClose, onSaved }: { product: Product | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(product ? toDraft(product) : blank);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setD({ ...d, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      name: d.name,
      description: d.description,
      image_urls: d.image_url.trim() ? [d.image_url.trim()] : [],
      price: Number(d.price),
      mrp: d.mrp ? Number(d.mrp) : null,
      unit: d.unit,
      stock_qty: Number(d.stock_qty),
      category: d.category,
      is_active: d.is_active,
    };
    try {
      if (product) await api(`/store/products/${product.id}`, { method: 'PATCH', body });
      else await api('/store/products', { body });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!product || !confirm(`Remove ${product.name} from your shop? Past orders keep their record.`)) return;
    await api(`/store/products/${product.id}`, { method: 'DELETE' });
    onSaved();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" role="dialog" aria-modal="true" aria-label={product ? 'Edit product' : 'Add product'} onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <h2>{product ? 'Edit product' : 'Add product'}</h2>
        <label>Name<input value={d.name} onChange={set('name')} required minLength={2} maxLength={80} autoFocus /></label>
        <label>Description<textarea value={d.description} onChange={set('description')} rows={3} maxLength={500} /></label>
        <div className="cols">
          <label>Price (₹)<input type="number" min={1} value={d.price} onChange={set('price')} required /></label>
          <label>MRP (₹, optional)<input type="number" min={1} value={d.mrp} onChange={set('mrp')} /></label>
        </div>
        <div className="cols">
          <label>Pack size<input value={d.unit} onChange={set('unit')} required placeholder="1 pc, set of 2, 5 L" /></label>
          <label>In stock<input type="number" min={0} value={d.stock_qty} onChange={set('stock_qty')} required /></label>
        </div>
        <label>
          Category
          <select value={d.category} onChange={set('category')}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Photo URL (optional)<input type="url" value={d.image_url} onChange={set('image_url')} placeholder="https://…" /></label>
        <label className="check">
          <input type="checkbox" checked={d.is_active} onChange={(e) => setD({ ...d, is_active: e.target.checked })} />
          Show to customers
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions">
          {product && <button type="button" className="btn link danger" onClick={remove}>Remove product</button>}
          <span />
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{product ? 'Save changes' : 'Add product'}</button>
        </div>
      </form>
    </div>
  );
}
