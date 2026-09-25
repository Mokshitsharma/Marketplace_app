export const API_URL = import.meta.env.VITE_API_URL ?? `${location.protocol}//${location.hostname}:4000`;

export type OrderStatus = 'placed' | 'store_confirmed' | 'picked_up' | 'on_the_way' | 'delivered' | 'cancelled';

export interface Store {
  id: string;
  name: string;
  address: string;
  area: string;
  geo_lat: number;
  geo_lng: number;
  category: string;
  is_open: boolean;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string;
  image_urls: string[];
  price: number;
  mrp: number | null;
  unit: string;
  stock_qty: number;
  category: string;
  store_name?: string;
  store_area?: string;
  store_open?: boolean;
}

export interface Address {
  id: string;
  label: string;
  line1: string;
  area: string;
  geo_lat: number;
  geo_lng: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  saved_addresses: Address[];
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  geo_lat: number;
  geo_lng: number;
}

export interface Order {
  id: string;
  code: string;
  store_id: string;
  store_name?: string;
  items: { product_id: string; name: string; qty: number; price: number }[];
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'refunded';
  driver_id: string | null;
  delivery_address: Address;
  eta: string | null;
  placed_at: string;
  store_respond_by: string;
  store_confirmed_at: string | null;
  ready_at: string | null;
  picked_up_at: string | null;
  on_the_way_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
}

export interface AppConfig {
  categories: { id: string; name: string; emoji: string }[];
  areas: { name: string; lat: number; lng: number }[];
  payment_methods: { id: 'upi' | 'card' | 'cod'; label: string; hint: string }[];
  delivery_fee: number;
  free_delivery_above: number;
  platform_fee: number;
  sla_minutes: number;
}

const TOKEN_KEY = 'movigo.customer.token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: session-only login */
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
    throw new ApiError('Can’t reach Movigo right now. Check that the backend is running on port 4000.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status);
  return data as T;
}

export const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
