import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/AuthContext';
import { getApiErrorMessage } from '@/api/client';
import { useToast } from '@/components/ui/Toast';

/**
 * Jovance Branded Login Layout:
 * Diagonal brand panel (#0b2e2b, #134e4a) + Crisp white card.
 * Uses fixed light-theme brand colors for highest contrast and clarity.
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
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#0b2e2b_0%,#134e4a_42%,#f4f7f8_42%,#f4f7f8_100%)] px-4 py-8">
      {/* Left Brand Panel for Desktop */}
      <div className="absolute inset-y-0 left-0 hidden w-[42%] lg:block">
        <div className="flex h-full flex-col justify-between p-12">
          <div>
            <img
              src="/jovance-logo-dark.png"
              alt="Jovance Laboratories Pvt. Ltd."
              className="h-28 w-auto max-w-[280px] object-contain drop-shadow"
            />
            {/* Gold text matches JOVANCE wordmark in brand logo */}
            <p className="mt-8 max-w-sm text-[15px] leading-relaxed font-medium text-[#d4af37]">
              One workspace for Admin and Medical Representatives — menus and data adapt to your
              role.
            </p>
          </div>
          {/* Red note matches LABORATORIES PVT. LTD. in logo */}
          <p className="text-sm font-semibold tracking-wide text-[#dc2626]">
            Secure JWT authentication · RBAC enforced
          </p>
        </div>
      </div>

      {/* Main Login Card */}
      <form
        onSubmit={(event) => void onSubmit(event)}
        className="relative z-10 w-full max-w-md rounded-2xl border border-[#d3dee1] bg-white p-8 sm:p-10 shadow-2xl transition-all"
      >
        {/* Mobile Header Logo */}
        <div className="mb-6 flex justify-center lg:hidden">
          <div className="flex w-full items-center justify-center rounded-xl bg-[#0b2e2b] px-4 py-4 shadow-sm">
            <img
              src="/jovance-logo-dark.png"
              alt="Jovance Laboratories Pvt. Ltd."
              className="h-20 w-auto max-w-[min(260px,80vw)] object-contain"
            />
          </div>
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-[#102226]">Sign in</h2>
        <p className="mt-1 text-sm text-[#617276]">
          Use your Admin or MR credentials. There is no self-registration.
        </p>

        <label className="mt-6 block text-sm font-semibold text-[#102226]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-1.5 h-11 w-full rounded-xl border border-[#d3dee1] bg-white px-3.5 text-sm text-[#102226] outline-none shadow-xs transition-all focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/15"
            autoComplete="username"
          />
        </label>

        <label className="mt-4 block text-sm font-semibold text-[#102226]">
          Password
          <div className="relative mt-1.5">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 w-full rounded-xl border border-[#d3dee1] bg-white py-2.5 pr-11 pl-3.5 text-sm text-[#102226] outline-none shadow-xs transition-all focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/15"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-[#617276] hover:bg-[#f4f7f8] hover:text-[#102226] transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#be123c] animate-fade-in">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 flex h-11.5 w-full items-center justify-center rounded-xl bg-[#0d5c56] px-4 text-sm font-bold text-white shadow-md transition-all hover:bg-[#0a4a45] hover:shadow-lg active:scale-[0.99] disabled:opacity-60 cursor-pointer"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}


