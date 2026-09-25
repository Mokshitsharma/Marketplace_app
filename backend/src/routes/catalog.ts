import { Router } from 'express';
import { config } from '../config.js';
import { db, getProduct, getStore, toProduct, toStore } from '../db.js';
import { AREAS, CATEGORIES } from '../domain/catalog.js';
import { OrderError } from '../services/orders.js';
import { paymentGateway } from '../services/payment.js';

export const catalogRouter = Router();

type Row = Record<string, unknown>;

const LIVE = `p.is_active = 1 AND s.verified_status = 'verified'`;

catalogRouter.get('/config', (_req, res) => {
  res.json({
    categories: CATEGORIES,
    areas: AREAS,
    payment_methods: paymentGateway.methods(),
    delivery_fee: config.deliveryFee,
    free_delivery_above: config.freeDeliveryAbove,
    platform_fee: config.platformFee,
    sla_minutes: config.deliverySlaMinutes,
  });
});

catalogRouter.get('/stores', (_req, res) => {
  const rows = db.prepare("SELECT * FROM stores WHERE verified_status = 'verified' ORDER BY name").all() as Row[];
  res.json(rows.map(toStore));
});

catalogRouter.get('/stores/:id', (req, res) => {
  const store = getStore(req.params.id);
  if (!store || store.verified_status !== 'verified') throw new OrderError('Store not found', 404);
  const products = (db.prepare('SELECT * FROM products WHERE store_id = ? AND is_active = 1 ORDER BY name').all(store.id) as Row[]).map(toProduct);
  res.json({ store, products });
});

/** GET /products?q=&category=&store_id= — search-as-you-type friendly. */
catalogRouter.get('/products', (req, res) => {
  const q = String(req.query.q ?? '').trim().toLowerCase();
  const category = String(req.query.category ?? '');
  const where = [LIVE];
  const args: string[] = [];
  if (q) {
    where.push('(LOWER(p.name) LIKE ? OR LOWER(p.description) LIKE ? OR LOWER(s.name) LIKE ?)');
    args.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push('p.category = ?');
    args.push(category);
  }
  const rows = db
    .prepare(
      `SELECT p.*, s.name AS store_name, s.area AS store_area, s.is_open AS store_open
       FROM products p JOIN stores s ON s.id = p.store_id
       WHERE ${where.join(' AND ')}
       ORDER BY (p.stock_qty = 0), p.created_at DESC LIMIT 100`,
    )
    .all(...args) as Row[];
  res.json(rows.map((r) => ({ ...toProduct(r), store_name: r.store_name, store_area: r.store_area, store_open: !!r.store_open })));
});

catalogRouter.get('/products/:id', (req, res) => {
  const product = getProduct(req.params.id);
  if (!product || !product.is_active) throw new OrderError('This item is no longer listed', 404);
  const store = getStore(product.store_id)!;
  const more = (db.prepare('SELECT * FROM products WHERE store_id = ? AND id != ? AND is_active = 1 LIMIT 6').all(store.id, product.id) as Row[]).map(toProduct);
  res.json({ product, store, more_from_store: more });
});
