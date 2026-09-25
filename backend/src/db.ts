import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { config } from './config.js';
import type { Address, Driver, Order, Product, Store } from './domain/types.js';

// Demo persistence uses Node's built-in SQLite so the project runs with zero
// external services. The SQL is kept portable; to move to PostgreSQL, swap this
// module for a `pg` pool and keep the same exported function signatures.

export const db = new DatabaseSync(config.dbFile);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  area TEXT NOT NULL,
  geo_lat REAL NOT NULL,
  geo_lng REAL NOT NULL,
  category TEXT NOT NULL,
  verified_status TEXT NOT NULL DEFAULT 'pending',
  owner_contact TEXT NOT NULL UNIQUE,
  bank_details TEXT,
  commission_rate REAL NOT NULL DEFAULT 0.1,
  is_open INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  store_id TEXT NOT NULL REFERENCES stores(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_urls TEXT NOT NULL DEFAULT '[]',
  price INTEGER NOT NULL,
  mrp INTEGER,
  unit TEXT NOT NULL DEFAULT '1 pc',
  stock_qty INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  label TEXT NOT NULL,
  line1 TEXT NOT NULL,
  area TEXT NOT NULL,
  geo_lat REAL NOT NULL,
  geo_lng REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  geo_lat REAL NOT NULL,
  geo_lng REAL NOT NULL,
  current_order_type TEXT NOT NULL DEFAULT 'idle'
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  store_id TEXT NOT NULL REFERENCES stores(id),
  items TEXT NOT NULL,
  subtotal INTEGER NOT NULL,
  delivery_fee INTEGER NOT NULL,
  platform_fee INTEGER NOT NULL,
  total INTEGER NOT NULL,
  status TEXT NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  payment_ref TEXT,
  driver_id TEXT REFERENCES drivers(id),
  delivery_address TEXT NOT NULL,
  eta TEXT,
  placed_at TEXT NOT NULL,
  store_respond_by TEXT NOT NULL,
  store_confirmed_at TEXT,
  ready_at TEXT,
  picked_up_at TEXT,
  on_the_way_at TEXT,
  delivered_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
`);

export const newId = () => randomUUID();
export const now = () => new Date().toISOString();

type Row = Record<string, unknown>;

export const toStore = (r: Row): Store => ({ ...(r as unknown as Store), is_open: !!r.is_open });

export const toProduct = (r: Row): Product => ({
  ...(r as unknown as Product),
  image_urls: JSON.parse(r.image_urls as string),
  is_active: !!r.is_active,
});

export const toOrder = (r: Row): Order => ({
  ...(r as unknown as Order),
  items: JSON.parse(r.items as string),
  delivery_address: JSON.parse(r.delivery_address as string),
});

export const toAddress = (r: Row): Address => r as unknown as Address;
export const toDriver = (r: Row): Driver => r as unknown as Driver;

/** Runs fn inside a transaction; rolls back on throw. */
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

// ---- common queries ----

export function getStore(id: string): Store | undefined {
  const r = db.prepare('SELECT * FROM stores WHERE id = ?').get(id);
  return r ? toStore(r as Row) : undefined;
}

export function getProduct(id: string): Product | undefined {
  const r = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return r ? toProduct(r as Row) : undefined;
}

export function getOrder(id: string): Order | undefined {
  const r = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  return r ? toOrder(r as Row) : undefined;
}

export function getDriver(id: string): Driver | undefined {
  const r = db.prepare('SELECT * FROM drivers WHERE id = ?').get(id);
  return r ? toDriver(r as Row) : undefined;
}

export function updateOrder(id: string, fields: Partial<Record<keyof Order, string | number | null>>): Order {
  const keys = Object.keys(fields);
  if (keys.length) {
    const sql = `UPDATE orders SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
    db.prepare(sql).run(...(Object.values(fields) as (string | number | null)[]), id);
  }
  return getOrder(id)!;
}
