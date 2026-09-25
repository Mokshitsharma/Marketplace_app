import { useEffect, useRef, useState } from 'react';
import { api, type Product } from '../lib/api';
import { useApp } from '../lib/state';
import { Empty, ProductCard, useDebounced } from '../components/ui';

const RECENT_KEY = 'movigo.customer.recent';

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export default function Search() {
  const { config } = useApp();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState<Product[] | null>(null);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const dq = useDebounced(q.trim(), 200);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => input.current?.focus(), []);

  useEffect(() => {
    if (!dq && !category) return setResults(null);
    let live = true;
    const params = new URLSearchParams({ q: dq, category });
    api<Product[]>(`/products?${params}`).then((r) => live && setResults(r)).catch(() => live && setResults([]));
    return () => {
      live = false;
    };
  }, [dq, category]);

  function remember(term: string) {
    if (!term) return;
    const next = [term, ...recent.filter((r) => r !== term)].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="page">
      <form className="search-head" role="search" onSubmit={(e) => { e.preventDefault(); remember(q.trim()); input.current?.blur(); }}>
        <input
          ref={input}
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search products or shops"
          aria-label="Search products or shops"
        />
      </form>

      <div className="chips">
        {config?.categories.map((c) => (
          <button key={c.id} className={category === c.id ? 'on' : ''} aria-pressed={category === c.id} onClick={() => setCategory(category === c.id ? '' : c.id)}>
            <span aria-hidden>{c.emoji}</span> {c.name}
          </button>
        ))}
      </div>

      {!results && recent.length > 0 && (
        <section>
          <h2 className="section-title">Recent searches</h2>
          <div className="chips wrap">
            {recent.map((r) => <button key={r} onClick={() => setQ(r)}>{r}</button>)}
          </div>
        </section>
      )}

      {results && results.length === 0 && (
        <Empty title={`Nothing matches “${dq}”`}>
          <p>Try a shorter word, like “table” or “lamp”, or browse a category above.</p>
        </Empty>
      )}
      {results && results.length > 0 && (
        <div className="grid" onClick={() => remember(dq)}>
          {results.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </main>
  );
}
