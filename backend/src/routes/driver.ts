import { Router } from 'express';
import { z } from 'zod';
import { getOrder } from '../db.js';
import { driverUpdate, OrderError } from '../services/orders.js';
import { publishDriverLocation } from '../services/realtime.js';

/**
 * Callback endpoints for Movigo's real driver app / dispatch system.
 * Unused while MockDispatchService drives the simulation.
 */
export const driverRouter = Router();

driverRouter.use((req, _res, next) => {
  if (req.headers['x-driver-key'] !== (process.env.DRIVER_API_KEY ?? 'demo-driver-key')) throw new OrderError('Bad driver key', 401);
  next();
});

driverRouter.post('/orders/:id/status', (req, res) => {
  const { status } = z.object({ status: z.enum(['picked_up', 'on_the_way', 'delivered']) }).parse(req.body);
  res.json(driverUpdate(req.params.id, status));
});

driverRouter.post('/orders/:id/location', (req, res) => {
  const { lat, lng } = z.object({ lat: z.number(), lng: z.number() }).parse(req.body);
  const order = getOrder(req.params.id);
  if (!order) throw new OrderError('Order not found', 404);
  publishDriverLocation(order, lat, lng);
  res.json({ ok: true });
});
