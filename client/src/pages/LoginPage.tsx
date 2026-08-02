import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { getApiErrorMessage } from '@/api/client';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@pharma-mr.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Login failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#0b2e2b_0%,#134e4a_42%,#f4f7f8_42%,#f4f7f8_100%)] px-4">
      <div className="absolute inset-y-0 left-0 hidden w-[42%] lg:block">
        <div className="flex h-full flex-col justify-between p-12 text-teal-50">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-teal-200/80">Pharma MR</p>
            <h1 className="mt-4 max-w-md text-4xl font-semibold leading-tight text-white">
              Management System
            </h1>
            <p className="mt-4 max-w-sm text-teal-100/85">
              One workspace for Admin and Medical Representatives — menus and data adapt to your
              role.
            </p>
          </div>
          <p className="text-sm text-teal-200/70">Secure JWT authentication · RBAC enforced</p>
        </div>
      </div>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="relative z-10 w-full max-w-md rounded-xl border border-[var(--color-border)] bg-white p-8 shadow-lg"
      >
        <h2 className="text-2xl font-semibold text-[var(--color-ink)]">Sign in</h2>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Use your Admin or MR credentials. There is no self-registration.
        </p>

        <label className="mt-6 block text-sm font-medium text-[var(--color-ink)]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-[var(--color-border)] px-3 py-2.5 outline-none ring-[var(--color-primary)] focus:ring-2"
            autoComplete="username"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-[var(--color-ink)]">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-[var(--color-border)] px-3 py-2.5 outline-none ring-[var(--color-primary)] focus:ring-2"
            autoComplete="current-password"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-[var(--color-primary)] px-4 py-2.5 font-medium text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
