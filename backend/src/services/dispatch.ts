import { config } from '../config.js';
import { db, getDriver, getStore, toDriver } from '../db.js';
import type { Driver, Order, OrderStatus } from '../domain/types.js';
import { distanceKm, rideMinutes } from './geo.js';

/**
 * ============================================================================
 *  DispatchService — the seam to Movigo's real driver allocation system.
 * ============================================================================
 *
 * The order service calls `assignDriver` exactly once, right after the store
 * confirms an order (the hard gate). To integrate with Movigo:
 *
 *   1. Implement `MovigoDispatchService.assignDriver` to call Movigo's driver
 *      allocation API with order type `marketplace`, pickup = store geo,
 *      drop = order.delivery_address geo. Return the assigned driver.
 *   2. Have the Movigo driver app report progress by calling
 *        POST /api/driver/orders/:id/status   { status: picked_up | on_the_way | delivered }
 *        POST /api/driver/orders/:id/location { lat, lng }
 *      with header `x-driver-key` (see routes/driver.ts). Those endpoints feed
 *      the same DriverReporter the mock uses below.
 *   3. Swap the export at the bottom of this file.
 */
export interface DispatchService {
  assignDriver(order: Order): Promise<{ driver: Driver; etaMinutes: number }>;
  /** Store has packed the order; the driver may pick it up. */
  orderReady(order: Order): void;
  /** Order was cancelled after assignment; release the driver. */
  orderCancelled(order: Order): void;
}

/** How driver progress flows back into the order service. */
export interface DriverReporter {
  status(orderId: string, status: Extract<OrderStatus, 'picked_up' | 'on_the_way' | 'delivered'>): void;
  location(orderId: string, lat: number, lng: number): void;
}

export class MovigoDispatchService implements DispatchService {
  async assignDriver(_order: Order): Promise<{ driver: Driver; etaMinutes: number }> {
    throw new Error('MovigoDispatchService is not wired yet — see the comment at the top of services/dispatch.ts');
  }
  orderReady(_order: Order) {}
  orderCancelled(_order: Order) {}
}

// ---------------------------------------------------------------------------
// Mock implementation: picks the nearest seeded driver and simulates the ride.
// ---------------------------------------------------------------------------

type Leg = 'to_store' | 'waiting' | 'to_customer';

interface Sim {
  orderId: string;
  driverId: string;
  leg: Leg;
  from: [number, number];
  to: [number, number];
  startedAt: number;
  durationMs: number;
  ready: boolean;
  arrivedAtStore: boolean;
  timer: NodeJS.Timeout;
}

const TICK_MS = 1000;

export class MockDispatchService implements DispatchService {
  private sims = new Map<string, Sim>();

  constructor(private reporter: DriverReporter) {}

  private scaled(minutes: number) {
    return (minutes * 60_000) / config.demoSpeed;
  }

  async assignDriver(order: Order) {
    const store = getStore(order.store_id)!;
    const drivers = (db.prepare("SELECT * FROM drivers WHERE current_order_type = 'idle'").all() as Record<string, unknown>[]).map(toDriver);
    const pool = drivers.length ? drivers : (db.prepare('SELECT * FROM drivers').all() as Record<string, unknown>[]).map(toDriver);
    if (!pool.length) throw new Error('No drivers seeded');

    pool.sort(
      (a, b) =>
        distanceKm(a.geo_lat, a.geo_lng, store.geo_lat, store.geo_lng) -
        distanceKm(b.geo_lat, b.geo_lng, store.geo_lat, store.geo_lng),
    );
    const driver = pool[0];
    db.prepare("UPDATE drivers SET current_order_type = 'marketplace' WHERE id = ?").run(driver.id);

    const toStoreMin = rideMinutes(distanceKm(driver.geo_lat, driver.geo_lng, store.geo_lat, store.geo_lng));
    const toCustomerMin = rideMinutes(
      distanceKm(store.geo_lat, store.geo_lng, order.delivery_address.geo_lat, order.delivery_address.geo_lng),
    );

    const sim: Sim = {
      orderId: order.id,
      driverId: driver.id,
      leg: 'to_store',
      from: [driver.geo_lat, driver.geo_lng],
      to: [store.geo_lat, store.geo_lng],
      startedAt: Date.now(),
      durationMs: this.scaled(toStoreMin),
      ready: !!order.ready_at,
      arrivedAtStore: false,
      timer: setInterval(() => this.tick(sim, order), TICK_MS),
    };
    this.sims.set(order.id, sim);

    // ETA in demo-time, so the customer's countdown matches what they'll see.
    const etaMinutes = (toStoreMin + 3 + toCustomerMin) / config.demoSpeed;
    return { driver: getDriver(driver.id)!, etaMinutes };
  }

  orderReady(order: Order) {
    const sim = this.sims.get(order.id);
    if (sim) sim.ready = true;
  }

  orderCancelled(order: Order) {
    const sim = this.sims.get(order.id);
    if (sim) this.finish(sim);
    else if (order.driver_id) db.prepare("UPDATE drivers SET current_order_type = 'idle' WHERE id = ?").run(order.driver_id);
  }

  private tick(sim: Sim, order: Order) {
    const t = Math.min(1, (Date.now() - sim.startedAt) / sim.durationMs);
    if (sim.leg !== 'waiting') {
      const lat = sim.from[0] + (sim.to[0] - sim.from[0]) * t;
      const lng = sim.from[1] + (sim.to[1] - sim.from[1]) * t;
      db.prepare('UPDATE drivers SET geo_lat = ?, geo_lng = ? WHERE id = ?').run(lat, lng, sim.driverId);
      this.reporter.location(sim.orderId, lat, lng);
    }
    if (t < 1 && sim.leg !== 'waiting') return;

    try {
      if (sim.leg === 'to_store') {
        sim.leg = 'waiting';
      }
      if (sim.leg === 'waiting' && sim.ready) {
        this.reporter.status(sim.orderId, 'picked_up');
        const store = getStore(order.store_id)!;
        const drop = order.delivery_address;
        sim.leg = 'to_customer';
        sim.from = [store.geo_lat, store.geo_lng];
        sim.to = [drop.geo_lat, drop.geo_lng];
        sim.startedAt = Date.now();
        sim.durationMs = this.scaled(rideMinutes(distanceKm(store.geo_lat, store.geo_lng, drop.geo_lat, drop.geo_lng)));
        // A short beat after pickup before the driver is en route.
        setTimeout(() => this.sims.has(sim.orderId) && this.reporter.status(sim.orderId, 'on_the_way'), 1500);
      } else if (sim.leg === 'to_customer') {
        this.reporter.status(sim.orderId, 'delivered');
        this.finish(sim);
      }
    } catch (e) {
      console.error('[dispatch] simulation step failed', e);
      this.finish(sim);
    }
  }

  private finish(sim: Sim) {
    clearInterval(sim.timer);
    this.sims.delete(sim.orderId);
    db.prepare("UPDATE drivers SET current_order_type = 'idle' WHERE id = ?").run(sim.driverId);
  }
}
