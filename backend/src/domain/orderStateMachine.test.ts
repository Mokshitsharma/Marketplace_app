import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedTransitions, assertTransition, TransitionError } from './orderStateMachine.js';
import type { Order } from './types.js';

const base = { status: 'placed', driver_id: null, ready_at: null, code: 'ML1' } as unknown as Order;
const at = (o: Partial<Order>) => ({ ...base, ...o }) as Order;

test('store confirms a placed order', () => {
  assert.doesNotThrow(() => assertTransition(base, 'store_confirmed', 'store'));
});

test('only the store can confirm', () => {
  assert.throws(() => assertTransition(base, 'store_confirmed', 'customer'), TransitionError);
  assert.throws(() => assertTransition(base, 'store_confirmed', 'driver'), TransitionError);
});

test('driver cannot skip the store confirmation gate', () => {
  assert.throws(() => assertTransition(base, 'picked_up', 'driver'), TransitionError);
});

test('pickup needs a driver and a ready order', () => {
  const confirmed = at({ status: 'store_confirmed' });
  assert.throws(() => assertTransition(confirmed, 'picked_up', 'driver'), /No driver/);
  assert.throws(() => assertTransition(at({ status: 'store_confirmed', driver_id: 'd1' }), 'picked_up', 'driver'), /not marked/);
  assert.doesNotThrow(() => assertTransition(at({ status: 'store_confirmed', driver_id: 'd1', ready_at: 'x' }), 'picked_up', 'driver'));
});

test('customer can cancel only before the store confirms', () => {
  assert.doesNotThrow(() => assertTransition(base, 'cancelled', 'customer'));
  assert.throws(() => assertTransition(at({ status: 'store_confirmed' }), 'cancelled', 'customer'), TransitionError);
});

test('delivered and cancelled are terminal', () => {
  assert.deepEqual(allowedTransitions(at({ status: 'delivered' }), 'system'), []);
  assert.deepEqual(allowedTransitions(at({ status: 'cancelled' }), 'store'), []);
});

test('happy path in order', () => {
  assert.doesNotThrow(() => assertTransition(at({ status: 'picked_up' }), 'on_the_way', 'driver'));
  assert.doesNotThrow(() => assertTransition(at({ status: 'on_the_way' }), 'delivered', 'driver'));
  assert.throws(() => assertTransition(at({ status: 'picked_up' }), 'delivered', 'driver'), TransitionError);
});
