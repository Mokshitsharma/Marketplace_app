import type { Server } from 'socket.io';
import type { Order } from '../domain/types.js';

// Thin indirection so services can publish without importing the socket server.
// Rooms: `order:<id>` (customer tracking), `store:<id>` (dashboard),
// `customer:<id>` (order history refresh).

let io: Server | null = null;

export function attachIo(server: Server) {
  io = server;
}

export function publishOrder(order: Order) {
  if (!io) return;
  io.to(`order:${order.id}`).to(`store:${order.store_id}`).to(`customer:${order.customer_id}`).emit('order:update', order);
}

export function publishDriverLocation(order: Order, lat: number, lng: number) {
  io?.to(`order:${order.id}`).emit('driver:location', { order_id: order.id, lat, lng });
}
