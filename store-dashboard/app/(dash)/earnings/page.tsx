'use client';

import { useEffect, useState } from 'react';
import { api, rupees } from '@/lib/api';
import { useStore } from '@/lib/storeContext';

interface Earnings {
  commission_rate: number;
  totals: { orders: number; gross: number; commission: number; net: number };
  days: { day: string; orders: number; gross: number; commission: number; net: number }[];
  payout_note: string;
}

export default function EarningsPage() {
  const { store } = useStore();
  const [data, setData] = useState<Earnings | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Earnings>('/store/earnings').then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p>Loading earnings…</p>;

  const { totals } = data;
  return (
    <div className="earnings">
      <section className="payout">
        <p>Your share from delivered orders</p>
        <strong>{rupees(totals.net)}</strong>
        <p className="muted">
          {rupees(totals.gross)} in sales across {totals.orders} {totals.orders === 1 ? 'order' : 'orders'}, less {Math.round(data.commission_rate * 100)}% Movigo commission ({rupees(totals.commission)}).
        </p>
        <p className="muted">{data.payout_note} Account {store.bank_details ?? 'not added yet'}.</p>
      </section>

      <table className="past">
        <thead>
          <tr><th>Day</th><th>Orders</th><th>Sales</th><th>Commission</th><th>Your share</th></tr>
        </thead>
        <tbody>
          {data.days.map((d) => (
            <tr key={d.day}>
              <td>{new Date(d.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
              <td>{d.orders}</td>
              <td>{rupees(d.gross)}</td>
              <td>−{rupees(d.commission)}</td>
              <td><b>{rupees(d.net)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!data.days.length && <p className="lane-empty">Earnings appear here once your first order is delivered.</p>}
    </div>
  );
}
