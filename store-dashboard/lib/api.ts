'use client';

import { io, type Socket } from 'socket.io-client';

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? (typeof window !== 'undefined' ? `${location.protocol}//${location.hostname}:4000` : 'http://localhost:4000');

export type OrderStatus = 'placed' | 'store_confirmed' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

export interface Store {
  id: string;
  name: string;
  address: string;
  area: string;
  owner_contact: string;
  bank_details: string | null;
  commission_rate: number;
  is_open: boolean;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  image_urls: string[];
  price: number;
  mrp: number | null;
  unit: string;
  stock_qty: number;
  category: string;
  is_active: boolean;
}

export interface Driver {
  name: string;
  phone: string;
  vehicle: string;
}

export interface Order {
  id: string;
  code: string;
  store_id: string;
  items: { product_id: string; name: string; qty: number; price: number }[];
  subtotal: number;
  total: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: string;
  driver_id: string | null;
  driver?: Driver | null;
  delivery_address: { label: string; line1: string; area: string };
  placed_at: string;
  store_respond_by: string;
  store_confirmed_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export const CATEGORIES = [
  { id: 'furniture', name: 'Furniture & decor' },
  { id: 'home', name: 'Home essentials' },
  { id: 'hardware', name: 'Hardware & tools' },
];

const TOKEN_KEY = 'movigo.store.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(t: string | null) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError('Can’t reach the Movigo server. Check that the backend is running on port 4000.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

let socket: Socket | null = null;
export function getSocket() {
  if (!socket) socket = io(API_URL, { auth: { token: getToken() }, transports: ['websocket'] });
  return socket;
}
export function closeSocket() {
  socket?.disconnect();
  socket = null;
}

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
