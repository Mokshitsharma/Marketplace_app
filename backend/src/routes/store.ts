import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { db, getDriver, getProduct, getStore, newId, now, toOrder, toProduct } from '../db.js';
import { CATEGORIES } from '../domain/catalog.js';
import { OrderError, storeAccept, storeMarkReady, storeReject } from '../services/orders.js';

export const storeRouter = Router();
storeRouter.use(requireRole('store'));

type Row = Record<string, unknown>;

storeRouter.get('/me', (req, res) => res.json(getStore(req.auth!.sub)));

storeRouter.patch('/me', (req, res) => {
  const { is_open } = z.object({ is_open: z.boolean() }).parse(req.body);
  db.prepare('UPDATE stores SET is_open = ? WHERE id = ?').run(is_open ? 1 : 0, req.auth!.sub);
  res.json(getStore(req.auth!.sub));
});

// ---- products ----

const productBody = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(''),
  image_urls: z.array(z.string().url()).max(5).default([]),
  price: z.number().int().positive(),
  mrp: z.number().int().positive().nullable().default(null),
  unit: z.string().trim().min(1).max(20).default('1 pc'),
  stock_qty: z.number().int().min(0),
  category: z.enum(CATEGORIES.map((c) => c.id) as [string, ...string[]]),
  is_active: z.boolean().default(true),
});

function ownProduct(storeId: string, id: string) {
  const p = getProduct(id);
  if (!p || p.store_id !== storeId) throw new OrderError('Product not found', 404);
  return p;
}

storeRouter.get('/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC').all(req.auth!.sub) as Row[];
  res.json(rows.map(toProduct));
});

storeRouter.post('/products', (req, res) => {
  const b = productBody.parse(req.body);
  const id = newId();
  db.prepare(
    `INSERT INTO products (id, store_id, name, description, image_urls, price, mrp, unit, stock_qty, category, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, req.auth!.sub, b.name, b.description, JSON.stringify(b.image_urls), b.price, b.mrp, b.unit, b.stock_qty, b.category, b.is_active ? 1 : 0, now());
  res.status(201).json(getProduct(id));
});

storeRouter.patch('/products/:id', (req, res) => {
  ownProduct(req.auth!.sub, req.params.id);
  const b = productBody.partial().parse(req.body);
  const fields: Record<string, string | number | null> = {};
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    fields[k] = k === 'image_urls' ? JSON.stringify(v) : typeof v === 'boolean' ? (v ? 1 : 0) : (v as string | number | null);
  }
  const keys = Object.keys(fields);
  if (keys.length) {
    db.prepare(`UPDATE products SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...Object.values(fields), req.params.id);
  }
  res.json(getProduct(req.params.id));
});

storeRouter.delete('/products/:id', (req, res) => {
  ownProduct(req.auth!.sub, req.params.id);
  // Soft delete: past orders still reference the product.
  db.prepare('UPDATE products SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---- orders ----

storeRouter.get('/orders', (req, res) => {
  const scope = req.query.scope === 'past' ? 'past' : 'active';
  const cond = scope === 'active' ? "status IN ('placed', 'store_confirmed')" : "status IN ('picked_up', 'on_the_way', 'delivered', 'cancelled')";
  const rows = db
    .prepare(`SELECT * FROM orders WHERE store_id = ? AND ${cond} ORDER BY placed_at DESC LIMIT 100`)
    .all(req.auth!.sub) as Row[];
  res.json(
    rows.map((r) => {
      const o = toOrder(r);
      return { ...o, driver: o.driver_id ? getDriver(o.driver_id) : null };
    }),
  );
});

storeRouter.post('/orders/:id/accept', async (req, res) => res.json(await storeAccept(req.auth!.sub, req.params.id)));

storeRouter.post('/orders/:id/reject', (req, res) => {
  const { reason } = z.object({ reason: z.string().max(120).optional() }).parse(req.body ?? {});
  res.json(storeReject(req.auth!.sub, req.params.id, reason));
});

storeRouter.post('/orders/:id/ready', (req, res) => res.json(storeMarkReady(req.auth!.sub, req.params.id)));

// ---- earnings ----

storeRouter.get('/earnings', (req, res) => {
  const store = getStore(req.auth!.sub)!;
  const rows = db
    .prepare(
      `SELECT substr(delivered_at, 1, 10) AS day, COUNT(*) AS orders, SUM(subtotal) AS gross
       FROM orders WHERE store_id = ? AND status = 'delivered'
       GROUP BY day ORDER BY day DESC LIMIT 30`,
    )
    .all(store.id) as { day: string; orders: number; gross: number }[];
  const days = rows.map((r) => {
    const commission = Math.round(r.gross * store.commission_rate);
    return { ...r, commission, net: r.gross - commission };
  });
  const sum = (k: 'orders' | 'gross' | 'commission' | 'net') => days.reduce((s, d) => s + d[k], 0);
  res.json({
    commission_rate: store.commission_rate,
    totals: { orders: sum('orders'), gross: sum('gross'), commission: sum('commission'), net: sum('net') },
    days,
    payout_note: 'Payouts settle every Monday to the bank account on file.',
  });
});
