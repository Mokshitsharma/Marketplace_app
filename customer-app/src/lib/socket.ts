import { io, type Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';

let socket: Socket | null = null;

/** One shared, authenticated socket per session. */
export function getSocket(): Socket {
  if (!socket) socket = io(API_URL, { auth: { token: getToken() }, transports: ['websocket'] });
  return socket;
}

export function closeSocket() {
  socket?.disconnect();
  socket = null;
}
