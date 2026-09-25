'use client';

import { createContext, useContext } from 'react';
import type { Store } from './api';

export const StoreCtx = createContext<{ store: Store; setStore: (s: Store) => void } | null>(null);

export function useStore() {
  const v = useContext(StoreCtx);
  if (!v) throw new Error('useStore outside the dashboard layout');
  return v;
}
