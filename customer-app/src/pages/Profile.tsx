import { useState } from 'react';
import { AddressForm } from '../components/AddressForm';
import { api, type Customer } from '../lib/api';
import { useApp } from '../lib/state';

export default function Profile() {
  const { me, refreshMe, logout } = useApp();
  const [adding, setAdding] = useState(false);

  async function remove(id: string) {
    await api<Customer>(`/me/addresses/${id}`, { method: 'DELETE' });
    await refreshMe();
  }

  return (
    <main className="page">
      <header className="topbar"><h1>Profile</h1></header>
      <section className="block">
        <h2>{me?.name || 'Your account'}</h2>
        <p className="muted">+91 {me?.phone}</p>
      </section>

      <section className="block">
        <h2>Saved addresses</h2>
        {me?.saved_addresses.map((a) => (
          <div key={a.id} className="addr-row">
            <span>
              <b>{a.label}</b>
              <small>{a.line1}, {a.area}</small>
            </span>
            <button className="linkbtn danger" onClick={() => remove(a.id)} aria-label={`Delete ${a.label} address`}>Delete</button>
          </div>
        ))}
        {adding ? (
          <AddressForm onSaved={async () => { await refreshMe(); setAdding(false); }} />
        ) : (
          <button className="linkbtn" onClick={() => setAdding(true)}>Add a new address</button>
        )}
      </section>

      <button className="ghost wide" onClick={logout}>Log out</button>
      <p className="muted small center">Movigo Local · demo build for testing</p>
    </main>
  );
}
