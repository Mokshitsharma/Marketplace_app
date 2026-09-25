import { Router } from 'express';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { db, getDriver, getOrder, getStore, newId, toAddress, toOrder } from '../db.js';
import { AREAS } from '../domain/catalog.js';
import { customerCancel, OrderError, placeOrder, quote } from '../services/orders.js';

export const customerRouter = Router();
customerRouter.use(requireRole('customer'));

type Row = Record<string, unknown>;

function profile(id: string) {
  const c = db.prepare('SELECT * FROM customers WHERE id = ?').get(id) as Row;
  const saved_addresses = (db.prepare('SELECT * FROM addresses WHERE customer_id = ?').all(id) as Row[]).map(toAddress);
  return { ...c, saved_addresses };
}

customerRouter.get('/me', (req, res) => res.json(profile(req.auth!.sub)));

customerRouter.patch('/me', (req, res) => {
  const { name } = z.object({ name: z.string().trim().min(1).max(60) }).parse(req.body);
  db.prepare('UPDATE customers SET name = ? WHERE id = ?').run(name, req.auth!.sub);
  res.json(profile(req.auth!.sub));
});

customerRouter.post('/me/addresses', (req, res) => {
  const body = z
    .object({ label: z.string().trim().min(1).max(20), line1: z.string().trim().min(3).max(120), area: z.string() })
    .parse(req.body);
  const area = AREAS.find((a) => a.name === body.area);
  if (!area) throw new OrderError('Pick an area from the list');
  // Small jitter so addresses in the same area don't sit on one map point.
  const jitter = () => (Math.random() - 0.5) * 0.006;
  db.prepare('INSERT INTO addresses (id, customer_id, label, line1, area, geo_lat, geo_lng) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    newId(), req.auth!.sub, body.label, body.line1, area.name, area.lat + jitter(), area.lng + jitter(),
  );
  res.json(profile(req.auth!.sub));
});

customerRouter.delete('/me/addresses/:id', (req, res) => {
  db.prepare('DELETE FROM addresses WHERE id = ? AND customer_id = ?').run(req.params.id, req.auth!.sub);
  res.json(profile(req.auth!.sub));
});

customerRouter.post('/orders/quote', (req, res) => {
  const { subtotal } = z.object({ subtotal: z.number().int().nonnegative() }).parse(req.body);
  res.json(quote(subtotal));
});

customerRouter.post('/orders', async (req, res) => {
  const body = z
    .object({
      store_id: z.string(),
      items: z.array(z.object({ product_id: z.string(), qty: z.number().int().min(1).max(20) })).min(1),
      address_id: z.string(),
      payment_method: z.enum(['upi', 'card', 'cod']),
    })
    .parse(req.body);
  res.status(201).json(await placeOrder(req.auth!.sub, body));
});

customerRouter.get('/orders', (req, res) => {
  const rows = db
    .prepare(
      `SELECT o.*, s.name AS store_name FROM orders o JOIN stores s ON s.id = o.store_id
       WHERE o.customer_id = ? ORDER BY o.placed_at DESC`,
    )
    .all(req.auth!.sub) as Row[];
  res.json(rows.map((r) => ({ ...toOrder(r), store_name: r.store_name })));
});

customerRouter.get('/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order || order.customer_id !== req.auth!.sub) throw new OrderError('Order not found', 404);
  res.json({ order, store: getStore(order.store_id), driver: order.driver_id ? getDriver(order.driver_id) : null });
});

customerRouter.post('/orders/:id/cancel', (req, res) => {
  res.json(customerCancel(req.auth!.sub, req.params.id));
});
