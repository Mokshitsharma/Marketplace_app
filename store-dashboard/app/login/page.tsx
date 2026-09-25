'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, closeSocket, setToken } from '@/lib/api';

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <section className="login-side">
        <span className="logo">Movigo <em>Local</em></span>
        <h1>Your shop, on every phone in Indore.</h1>
        <p>Confirm orders in two minutes, keep stock honest, and a Movigo rider handles the rest.</p>
      </section>
      <section className="login-form">
        <h2>Shop owner login</h2>
        {step === 'phone' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api('/auth/otp/send', { body: { phone, role: 'store' } });
                setStep('otp');
              });
            }}
          >
            <label htmlFor="phone">Registered mobile number</label>
            <div className="phone-input">
              <span>+91</span>
              <input
                id="phone"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                autoFocus
              />
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary" disabled={busy || phone.length !== 10}>Get OTP</button>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const { token } = await api<{ token: string }>('/auth/otp/verify', { body: { phone, code, role: 'store' } });
                setToken(token);
                closeSocket();
                router.replace('/orders');
              });
            }}
          >
            <label htmlFor="otp">OTP sent to +91 {phone}</label>
            <input
              id="otp"
              className="otp"
              inputMode="numeric"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <p className="demo-note">Demo build: the OTP is always <b>1234</b>.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn primary" disabled={busy || code.length !== 4}>Log in</button>
            <button type="button" className="btn link" onClick={() => { setStep('phone'); setCode(''); }}>Change number</button>
          </form>
        )}
        <div className="demo-list">
          <p>Demo shops</p>
          <ul>
            <li><button type="button" onClick={() => setPhone('9000000001')}>9000000001</button> Lakdi Ghar Furnishers</li>
            <li><button type="button" onClick={() => setPhone('9000000002')}>9000000002</button> Sajawat Home Decor</li>
            <li><button type="button" onClick={() => setPhone('9000000003')}>9000000003</button> Ghar Ki Zaroorat</li>
            <li><button type="button" onClick={() => setPhone('9000000004')}>9000000004</button> Mehta Hardware &amp; Sanitary</li>
            <li><button type="button" onClick={() => setPhone('9000000005')}>9000000005</button> Bartan Bhandar Sarafa</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
