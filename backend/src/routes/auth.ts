import { Router } from 'express';
import { z } from 'zod';
import { signToken } from '../auth.js';
import { config } from '../config.js';
import { db, getStore, newId, toStore } from '../db.js';
import { otpService } from '../services/otp.js';
import { OrderError } from '../services/orders.js';

export const authRouter = Router();

const phone = z.string().regex(/^[6-9]\d{9}$/, 'Enter a 10-digit mobile number');
const role = z.enum(['customer', 'store']);

authRouter.post('/otp/send', async (req, res) => {
  const body = z.object({ phone, role }).parse(req.body);
  if (body.role === 'store' && !db.prepare('SELECT id FROM stores WHERE owner_contact = ?').get(body.phone)) {
    throw new OrderError('No store is registered with this number. Contact Movigo ops to onboard.', 404);
  }
  await otpService.send(body.phone);
  // demo_otp is returned only because this is a demo build.
  res.json({ sent: true, demo_otp: config.demoOtp });
});

authRouter.post('/otp/verify', async (req, res) => {
  const body = z.object({ phone, role, code: z.string() }).parse(req.body);
  if (!(await otpService.verify(body.phone, body.code))) throw new OrderError('That OTP is incorrect. For the demo, use 1234.', 401);

  if (body.role === 'store') {
    const row = db.prepare('SELECT * FROM stores WHERE owner_contact = ?').get(body.phone);
    if (!row) throw new OrderError('No store is registered with this number', 404);
    const store = toStore(row as Record<string, unknown>);
    return res.json({ token: signToken({ sub: store.id, role: 'store' }), store: getStore(store.id) });
  }

  let customer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(body.phone) as { id: string } | undefined;
  if (!customer) {
    const id = newId();
    db.prepare('INSERT INTO customers (id, name, phone) VALUES (?, ?, ?)').run(id, '', body.phone);
    customer = { id };
  }
  res.json({ token: signToken({ sub: customer.id, role: 'customer' }) });
});
