import { useState } from 'react';
import { api, type Customer } from '../lib/api';
import { useApp } from '../lib/state';

export function AddressForm({ onSaved }: { onSaved: (c: Customer) => void }) {
  const { config } = useApp();
  const [label, setLabel] = useState('Home');
  const [line1, setLine1] = useState('');
  const [area, setArea] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="addr-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          onSaved(await api<Customer>('/me/addresses', { body: { label, line1, area } }));
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="seg" role="radiogroup" aria-label="Address label">
        {['Home', 'Work', 'Other'].map((l) => (
          <button type="button" key={l} role="radio" aria-checked={label === l} className={label === l ? 'on' : ''} onClick={() => setLabel(l)}>
            {l}
          </button>
        ))}
      </div>
      <label>
        House, building, street
        <input value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="203, Shalimar Township" required minLength={3} />
      </label>
      <label>
        Area
        <select value={area} onChange={(e) => setArea(e.target.value)} required>
          <option value="" disabled>Choose your area</option>
          {config?.areas.map((a) => <option key={a.name}>{a.name}</option>)}
        </select>
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="cta" disabled={busy}>Save address</button>
    </form>
  );
}
