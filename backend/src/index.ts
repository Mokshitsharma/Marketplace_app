import { createServer } from 'node:http';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { Server } from 'socket.io';
import { ZodError } from 'zod';
import { verifyToken } from './auth.js';
import { config } from './config.js';
import { db, getOrder } from './db.js';
import { TransitionError } from './domain/orderStateMachine.js';
import { authRouter } from './routes/auth.js';
import { catalogRouter } from './routes/catalog.js';
import { customerRouter } from './routes/customer.js';
import { driverRouter } from './routes/driver.js';
import { storeRouter } from './routes/store.js';
import { seedIfEmpty } from './seed.js';
import { OrderError, sweepExpiredOrders } from './services/orders.js';
import { attachIo } from './services/realtime.js';

seedIfEmpty();

const app = express();
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api', catalogRouter);
app.use('/api/store', storeRouter);
app.use('/api/driver', driverRouter);
app.use('/api', customerRouter); // /api/me, /api/orders — mounted last: its auth guard covers everything it sees

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) return res.status(400).json({ error: err.issues[0]?.message ?? 'Invalid request' });
  if (err instanceof OrderError) return res.status(err.status).json({ error: err.message });
  if (err instanceof TransitionError) return res.status(409).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side. Try again.' });
});

const server = createServer(app);
const io = new Server(server, { cors: { origin: config.corsOrigins } });
attachIo(io);

io.on('connection', (socket) => {
  const claims = verifyToken(String(socket.handshake.auth?.token ?? ''));
  if (!claims) return socket.disconnect(true);
  socket.join(`${claims.role}:${claims.sub}`);

  socket.on('order:watch', (orderId: string) => {
    const o = getOrder(orderId);
    if (o && claims.role === 'customer' && o.customer_id === claims.sub) socket.join(`order:${o.id}`);
  });
  socket.on('order:unwatch', (orderId: string) => socket.leave(`order:${orderId}`));
});

setInterval(sweepExpiredOrders, 5000);

// Mock driver simulations live in memory; orders mid-ride when the server
// restarted can't resume, so release their drivers.
db.prepare("UPDATE drivers SET current_order_type = 'idle'").run();

server.listen(config.port, () => {
  console.log(`Movigo Local API on http://localhost:${config.port}  (demo OTP: ${config.demoOtp})`);
});
