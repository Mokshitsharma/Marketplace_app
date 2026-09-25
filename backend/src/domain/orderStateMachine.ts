import type { Order, OrderStatus } from './types.js';

/**
 * Order lifecycle:
 *
 *   placed ──store accepts──▶ store_confirmed ──driver picks up──▶ picked_up
 *     │                          │                                    │
 *     │ store rejects /          │ store cancels                      ▼
 *     │ response window expires  │                                on_the_way ──▶ delivered
 *     │ customer cancels         │
 *     ▼                          ▼
 *   cancelled ◀──────────────────┘
 *
 * The store confirmation is a hard gate: no driver is dispatched until the
 * order reaches `store_confirmed`, and a driver cannot pick up until the store
 * has marked the order ready (`ready_at`).
 */

export type Actor = 'customer' | 'store' | 'driver' | 'system';

interface Transition {
  to: OrderStatus;
  actors: Actor[];
  guard?: (order: Order) => string | null; // returns an error message when blocked
}

const TRANSITIONS: Record<OrderStatus, Transition[]> = {
  placed: [
    { to: 'store_confirmed', actors: ['store'] },
    { to: 'cancelled', actors: ['store', 'customer', 'system'] },
  ],
  store_confirmed: [
    {
      to: 'picked_up',
      actors: ['driver'],
      guard: (o) =>
        !o.driver_id ? 'No driver assigned yet' : !o.ready_at ? 'Store has not marked the order ready' : null,
    },
    { to: 'cancelled', actors: ['store', 'system'] },
  ],
  picked_up: [{ to: 'on_the_way', actors: ['driver'] }],
  on_the_way: [{ to: 'delivered', actors: ['driver'] }],
  delivered: [],
  cancelled: [],
};

/** Timestamp column written when an order enters each status. */
export const STATUS_TIMESTAMP: Record<Exclude<OrderStatus, 'placed'>, keyof Order> = {
  store_confirmed: 'store_confirmed_at',
  picked_up: 'picked_up_at',
  on_the_way: 'on_the_way_at',
  delivered: 'delivered_at',
  cancelled: 'cancelled_at',
};

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionError';
  }
}

export function allowedTransitions(order: Order, actor: Actor): OrderStatus[] {
  return TRANSITIONS[order.status]
    .filter((t) => t.actors.includes(actor) && !t.guard?.(order))
    .map((t) => t.to);
}

/** Throws TransitionError when `actor` may not move `order` to `to`. */
export function assertTransition(order: Order, to: OrderStatus, actor: Actor): void {
  const t = TRANSITIONS[order.status].find((x) => x.to === to);
  if (!t) throw new TransitionError(`Order ${order.code} cannot go from ${order.status} to ${to}`);
  if (!t.actors.includes(actor)) throw new TransitionError(`A ${actor} cannot move an order to ${to}`);
  const blocked = t.guard?.(order);
  if (blocked) throw new TransitionError(blocked);
}

export function isTerminal(status: OrderStatus): boolean {
  return TRANSITIONS[status].length === 0;
}
