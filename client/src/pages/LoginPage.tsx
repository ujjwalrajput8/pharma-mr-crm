import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { getApiErrorMessage } from '@/api/client';
import { useToast } from '@/components/ui/Toast';

/**
 * Same layout as before (diagonal brand panel + white card).
 * Form uses fixed light-theme hex colors so dark-mode CSS vars
 * cannot make labels/inputs unreadable on the white card.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [email, setEmail] = useState('admin@pharma-mr.local');
  const [password, setPassword] = useState('Admin@12345');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      toast.success('Login successful', 'Welcome back to Pharma MR CRM.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const message = getApiErrorMessage(err, 'Login failed');
      setError(message);
      toast.error('Login failed', message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#0b2e2b_0%,#134e4a_42%,#f4f7f8_42%,#f4f7f8_100%)] px-4">
      <div className="absolute inset-y-0 left-0 hidden w-[42%] lg:block">
        <div className="flex h-full flex-col justify-between p-12">
          <div>
            <img
              src="/jovance-logo-dark.png"
              alt="Jovance Laboratories Pvt. Ltd."
              className="h-28 w-auto max-w-[280px] object-contain"
            />
            {/* Gold matches JOVANCE wordmark in logo */}
            <p className="mt-8 max-w-sm text-[15px] leading-relaxed text-[#d4af37]">
              One workspace for Admin and Medical Representatives — menus and data adapt to your
              role.
            </p>
          </div>
          {/* Red matches LABORATORIES PVT. LTD. in logo */}
          <p className="text-sm font-medium text-[#dc2626]">
            Secure JWT authentication · RBAC enforced
          </p>
        </div>
      </div>

      <form
        onSubmit={(event) => void onSubmit(event)}
        className="relative z-10 w-full max-w-md rounded-xl border border-[#d3dee1] bg-white p-8 shadow-lg"
      >
        <img
          src="/jovance-logo.png"
          alt="Jovance Laboratories Pvt. Ltd."
          className="mb-6 h-20 w-auto max-w-[220px] object-contain lg:hidden"
        />
        <h2 className="text-2xl font-semibold text-[#102226]">Sign in</h2>
        <p className="mt-1 text-sm text-[#617276]">
          Use your Admin or MR credentials. There is no self-registration.
        </p>

        <label className="mt-6 block text-sm font-medium text-[#102226]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-[#d3dee1] bg-white px-3 py-2.5 text-[#102226] outline-none ring-[#0f766e] focus:ring-2"
            autoComplete="username"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-[#102226]">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 w-full rounded-md border border-[#d3dee1] bg-white px-3 py-2.5 text-[#102226] outline-none ring-[#0f766e] focus:ring-2"
            autoComplete="current-password"
          />
        </label>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-[#be123c]">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-[#0f766e] px-4 py-2.5 font-medium text-white hover:bg-[#0d9488] disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
