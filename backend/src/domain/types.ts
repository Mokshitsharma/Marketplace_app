// Shared domain contract. Frontends mirror these shapes in their own api types.

export const ORDER_STATUSES = [
  'placed',
  'store_confirmed',
  'picked_up',
  'on_the_way',
  'delivered',
  'cancelled',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Role = 'customer' | 'store';

export interface Store {
  id: string;
  name: string;
  address: string;
  area: string;
  geo_lat: number;
  geo_lng: number;
  category: string;
  verified_status: 'pending' | 'verified' | 'suspended';
  owner_contact: string;
  bank_details: string | null;
  commission_rate: number;
  is_open: boolean;
}

export interface Product {
  id: string;
  store_id: string;
  name: string;
  description: string;
  image_urls: string[];
  price: number; // rupees, integer
  mrp: number | null;
  unit: string;
  stock_qty: number;
  category: string;
  is_active: boolean;
  created_at: string;
}

export interface Address {
  id: string;
  customer_id: string;
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

export interface OrderItem {
  product_id: string;
  name: string;
  qty: number;
  price: number;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  geo_lat: number;
  geo_lng: number;
  current_order_type: 'logistics' | 'marketplace' | 'idle';
}

export interface Order {
  id: string;
  code: string;
  customer_id: string;
  store_id: string;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  platform_fee: number;
  total: number;
  status: OrderStatus;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'refunded';
  payment_ref: string | null;
  driver_id: string | null;
  delivery_address: Omit<Address, 'customer_id'>;
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
