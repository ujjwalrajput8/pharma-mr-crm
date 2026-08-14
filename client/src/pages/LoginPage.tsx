import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      toast.success('Login successful', 'Welcome back to Field Force Panel.');
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
        <div className="mb-6 flex justify-center lg:hidden">
          <div className="flex w-full items-center justify-center rounded-lg bg-[#0b2e2b] px-4 py-4">
            <img
              src="/jovance-logo-dark.png"
              alt="Jovance Laboratories Pvt. Ltd."
              className="h-24 w-auto max-w-[min(260px,80vw)] object-contain"
            />
          </div>
        </div>
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
          <div className="relative mt-1.5">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-[#d3dee1] bg-white py-2.5 pr-11 pl-3 text-[#102226] outline-none ring-[#0f766e] focus:ring-2"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-[#617276] hover:bg-[#f4f7f8] hover:text-[#102226]"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {error ? (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-[#be123c]">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 h-11 w-full touch-manipulation rounded-[6px] bg-[#0d5c56] px-4 text-sm font-semibold text-white hover:bg-[#0a4a45] disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
