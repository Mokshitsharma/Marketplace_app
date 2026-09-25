import { config } from '../config.js';
import { db, getOrder, getProduct, getStore, newId, now, toAddress, toOrder, tx, updateOrder } from '../db.js';
import { assertTransition, STATUS_TIMESTAMP, type Actor } from '../domain/orderStateMachine.js';
import type { Order, OrderItem, OrderStatus } from '../domain/types.js';
import { MockDispatchService, type DispatchService, type DriverReporter } from './dispatch.js';
import { paymentGateway, type PaymentMethod } from './payment.js';
import { publishDriverLocation, publishOrder } from './realtime.js';

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function quote(subtotal: number) {
  const delivery_fee = subtotal >= config.freeDeliveryAbove ? 0 : config.deliveryFee;
  const platform_fee = config.platformFee;
  return { subtotal, delivery_fee, platform_fee, total: subtotal + delivery_fee + platform_fee };
}

const addMinutes = (iso: string, m: number) => new Date(new Date(iso).getTime() + m * 60_000).toISOString();

function orderCode() {
  const n = (db.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }).n + 1;
  return `ML${String(1000 + n)}`;
}

/** Apply a state-machine transition, stamp its timestamp, and publish it. */
function transition(order: Order, to: OrderStatus, actor: Actor, extra: Partial<Record<keyof Order, string | number | null>> = {}) {
  assertTransition(order, to, actor);
  const stamp = STATUS_TIMESTAMP[to as Exclude<OrderStatus, 'placed'>];
  const updated = updateOrder(order.id, { status: to, [stamp]: now(), ...extra });
  publishOrder(updated);
  return updated;
}

// ---- dispatch wiring ----

const reporter: DriverReporter = {
  status(orderId, status) {
    driverUpdate(orderId, status);
  },
  location(orderId, lat, lng) {
    const o = getOrder(orderId);
    if (o) publishDriverLocation(o, lat, lng);
  },
};

export const dispatch: DispatchService = new MockDispatchService(reporter);

// ---- customer actions ----

export interface PlaceOrderInput {
  store_id: string;
  items: { product_id: string; qty: number }[];
  address_id: string;
  payment_method: PaymentMethod;
}

export async function placeOrder(customerId: string, input: PlaceOrderInput): Promise<Order> {
  const store = getStore(input.store_id);
  if (!store || store.verified_status !== 'verified') throw new OrderError('This store is not available');
  if (!store.is_open) throw new OrderError(`${store.name} is closed right now`);

  const addrRow = db.prepare('SELECT * FROM addresses WHERE id = ? AND customer_id = ?').get(input.address_id, customerId);
  if (!addrRow) throw new OrderError('Choose a delivery address');
  const { customer_id: _c, ...address } = toAddress(addrRow as Record<string, unknown>);

  const code = orderCode();
  const placed_at = now();

  const order = tx(() => {
    const items: OrderItem[] = input.items.map(({ product_id, qty }) => {
      const p = getProduct(product_id);
      if (!p || p.store_id !== store.id || !p.is_active) throw new OrderError('An item in your cart is no longer available');
      if (p.stock_qty < qty) throw new OrderError(`Only ${p.stock_qty} left of ${p.name}`);
      // Reserve stock now; released again if the order is cancelled.
      db.prepare('UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?').run(qty, p.id);
      return { product_id: p.id, name: p.name, qty, price: p.price };
    });
    const totals = quote(items.reduce((s, i) => s + i.price * i.qty, 0));
    const id = newId();
    db.prepare(
      `INSERT INTO orders (id, code, customer_id, store_id, items, subtotal, delivery_fee, platform_fee, total, status,
         payment_method, payment_status, delivery_address, eta, placed_at, store_respond_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'placed', ?, 'pending', ?, ?, ?, ?)`,
    ).run(
      id, code, customerId, store.id, JSON.stringify(items), totals.subtotal, totals.delivery_fee, totals.platform_fee,
      totals.total, input.payment_method, JSON.stringify(address), addMinutes(placed_at, config.deliverySlaMinutes),
      placed_at, new Date(Date.now() + config.storeResponseSeconds * 1000).toISOString(),
    );
    return getOrder(id)!;
  });

  const pay = await paymentGateway.createPayment({ orderCode: code, amount: order.total, method: input.payment_method });
  const saved = updateOrder(order.id, { payment_status: pay.status, payment_ref: pay.ref });
  publishOrder(saved);
  return saved;
}

export function customerCancel(customerId: string, orderId: string) {
  const o = getOrder(orderId);
  if (!o || o.customer_id !== customerId) throw new OrderError('Order not found', 404);
  return cancel(o, 'customer', 'Cancelled by you');
}

// ---- store actions ----

function storeOrder(storeId: string, orderId: string) {
  const o = getOrder(orderId);
  if (!o || o.store_id !== storeId) throw new OrderError('Order not found', 404);
  return o;
}

export async function storeAccept(storeId: string, orderId: string) {
  const o = storeOrder(storeId, orderId);
  if (o.status === 'placed' && new Date(o.store_respond_by) < new Date()) {
    cancel(o, 'system', 'Store did not respond in time');
    throw new OrderError('The response window has closed and the order was cancelled');
  }
  const confirmed = transition(o, 'store_confirmed', 'store');
  try {
    const { driver, etaMinutes } = await dispatch.assignDriver(confirmed);
    const eta = addMinutes(now(), etaMinutes);
    const withDriver = updateOrder(o.id, { driver_id: driver.id, eta });
    publishOrder(withDriver);
    return withDriver;
  } catch (e) {
    console.error('[dispatch] assignDriver failed', e);
    return confirmed; // stays store_confirmed without a driver; ops can reassign
  }
}

export function storeReject(storeId: string, orderId: string, reason?: string) {
  return cancel(storeOrder(storeId, orderId), 'store', reason || 'Store could not fulfil this order');
}

export function storeMarkReady(storeId: string, orderId: string) {
  const o = storeOrder(storeId, orderId);
  if (o.status !== 'store_confirmed') throw new OrderError('Only confirmed orders can be marked ready');
  if (o.ready_at) return o;
  const updated = updateOrder(o.id, { ready_at: now() });
  dispatch.orderReady(updated);
  publishOrder(updated);
  return updated;
}

// ---- driver / system ----

export function driverUpdate(orderId: string, status: 'picked_up' | 'on_the_way' | 'delivered') {
  const o = getOrder(orderId);
  if (!o) throw new OrderError('Order not found', 404);
  const extra: Partial<Record<keyof Order, string | number | null>> = {};
  if (status === 'delivered' && o.payment_status === 'pending') extra.payment_status = 'paid'; // COD collected
  if (status === 'delivered') extra.eta = now();
  return transition(o, status, 'driver', extra);
}

function cancel(o: Order, actor: Actor, reason: string) {
  const updated = tx(() => {
    const next = transition(o, 'cancelled', actor, { cancel_reason: reason });
    for (const i of o.items) db.prepare('UPDATE products SET stock_qty = stock_qty + ? WHERE id = ?').run(i.qty, i.product_id);
    return next;
  });
  if (o.driver_id) dispatch.orderCancelled(o);
  if (o.payment_status === 'paid' && o.payment_ref) {
    void paymentGateway.refund({ ref: o.payment_ref, amount: o.total });
    const refunded = updateOrder(o.id, { payment_status: 'refunded' });
    publishOrder(refunded);
    return refunded;
  }
  return updated;
}

/** Auto-cancel orders whose store response window has passed. */
export function sweepExpiredOrders() {
  const rows = db.prepare("SELECT * FROM orders WHERE status = 'placed' AND store_respond_by < ?").all(now()) as Record<string, unknown>[];
  for (const r of rows) {
    try {
      cancel(toOrder(r), 'system', 'Store did not respond in time');
    } catch (e) {
      console.error('[sweep] failed to cancel', r.id, e);
    }
  }
}
