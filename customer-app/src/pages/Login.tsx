import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, type Customer } from '../lib/api';
import { useApp } from '../lib/state';

export default function Login() {
  const { login } = useApp();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';
  const [step, setStep] = useState<'phone' | 'otp' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
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
      <div className="login-brand">
        <span className="logo">Movigo <em>Local</em></span>
        <p>Furniture, decor and tools from Indore’s own shops, at your door in 30 minutes.</p>
      </div>

      <div className="login-card">
        {step === 'phone' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api('/auth/otp/send', { body: { phone, role: 'customer' } });
                setStep('otp');
              });
            }}
          >
            <label htmlFor="phone">Mobile number</label>
            <div className="phone-input">
              <span>+91</span>
              <input
                id="phone"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="98765 43210"
                autoFocus
              />
            </div>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="cta" disabled={busy || phone.length !== 10}>Get OTP</button>
          </form>
        )}

        {step === 'otp' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                const { token } = await api<{ token: string }>('/auth/otp/verify', { body: { phone, code, role: 'customer' } });
                await login(token);
                const me = await api<Customer>('/me');
                if (!me.name) setStep('name');
                else nav(next, { replace: true });
              });
            }}
          >
            <label htmlFor="otp">Enter the OTP sent to +91 {phone}</label>
            <input
              id="otp"
              className="otp"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={4}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <p className="demo-note">Demo build: the OTP is always <b>1234</b>.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="cta" disabled={busy || code.length !== 4}>Verify and continue</button>
            <button type="button" className="linkbtn" onClick={() => { setStep('phone'); setCode(''); setError(''); }}>
              Change number
            </button>
          </form>
        )}

        {step === 'name' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                await api('/me', { method: 'PATCH', body: { name } });
                nav(next, { replace: true });
              });
            }}
          >
            <label htmlFor="name">What should we call you?</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoFocus />
            {error && <p className="error" role="alert">{error}</p>}
            <button className="cta" disabled={busy || !name.trim()}>Save name</button>
          </form>
        )}
      </div>
      <p className="muted small center">Demo customer: 9876543210</p>
    </main>
  );
}
