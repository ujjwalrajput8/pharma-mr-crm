import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart3,
  CalendarCheck2,
  Eye,
  EyeOff,
  LogIn,
  Lock,
  Mail,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { getApiErrorMessage } from '@/api/client';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Page';
import { fieldControlClass, fieldLabelClass } from '@/components/ui/formStyles';
import { cn } from '@/utils/cn';

const HIGHLIGHTS = [
  {
    icon: MapPin,
    title: 'Field-first',
    body: 'GPS check-in, day-wise register and DCR from the beat.',
  },
  {
    icon: CalendarCheck2,
    title: 'Leave that closes the loop',
    body: 'Apply → manager approves → attendance marks itself.',
  },
  {
    icon: BarChart3,
    title: 'One source of truth',
    body: 'Stock moves through an append-only ledger. Nothing edited in place.',
  },
];

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  // Never pre-fill credentials — this page is public.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email.trim(), password);
      toast.success('Signed in', 'Welcome back to the Field Force panel.');
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
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      {/* ── Brand panel ──────────────────────────────────────────────────── */}
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#0b2e2b_0%,#0f4a45_48%,#08211f_100%)] lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* Soft glow + hairline grid, so the panel has depth without noise. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-teal-400/18 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 bottom-0 h-[22rem] w-[22rem] rounded-full bg-emerald-300/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '44px 44px',
          }}
        />

        <div className="relative">
          <img
            src="/jovance-logo-dark.png"
            alt="Jovance Laboratories Pvt. Ltd."
            className="h-24 w-auto max-w-[260px] object-contain"
          />
          <h1 className="mt-10 max-w-md text-3xl leading-[1.15] font-bold tracking-tight text-white">
            The whole field force,
            <br />
            <span className="text-teal-300">in one workspace.</span>
          </h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-teal-50/60">
            Admin, Manager and MR share one login. Menus and data follow the role — nothing
            more, nothing less.
          </p>
        </div>

        <ul className="relative space-y-4">
          {HIGHLIGHTS.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/8 text-teal-300 backdrop-blur-sm">
                  <Icon size={16} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-white">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-teal-50/55">{item.body}</p>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="relative flex items-center gap-2 text-[11px] font-medium tracking-wide text-teal-50/45">
          <ShieldCheck size={13} />
          JWT auth · role-based access enforced on every request
        </p>
      </aside>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <main className="flex items-center justify-center bg-[var(--color-bg)] px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          {/* Mobile brand mark */}
          <div className="mb-8 flex justify-center lg:hidden">
            <div className="flex w-full max-w-xs items-center justify-center rounded-2xl bg-[#0b2e2b] px-5 py-5">
              <img
                src="/jovance-logo-dark.png"
                alt="Jovance Laboratories Pvt. Ltd."
                className="h-16 w-auto max-w-[min(220px,70vw)] object-contain"
              />
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-[22px] font-bold tracking-tight text-[var(--color-ink)]">
              Sign in
            </h2>
            <p className="mt-1 text-[13px] text-[var(--color-muted)]">
              Accounts are created by your administrator — there is no self sign-up.
            </p>
          </div>

          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
            <div>
              <label htmlFor="login-email" className={cn(fieldLabelClass, 'mb-1.5')}>
                Work email
              </label>
              <div className="relative flex items-center">
                <Mail
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 text-[var(--color-muted)]"
                />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@jovance.com"
                  className={cn(fieldControlClass, 'pl-10')}
                  autoComplete="username"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className={cn(fieldLabelClass, 'mb-1.5')}>
                Password
              </label>
              <div className="relative flex items-center">
                <Lock
                  size={15}
                  aria-hidden
                  className="pointer-events-none absolute left-3.5 text-[var(--color-muted)]"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyUp={(event) =>
                    setCapsOn(event.getModifierState?.('CapsLock') ?? false)
                  }
                  placeholder="••••••••"
                  className={cn(fieldControlClass, 'pr-11 pl-10')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 cursor-pointer rounded-lg p-1.5 text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-ink)]"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {capsOn ? (
                <p className="mt-1.5 text-[11px] font-medium text-[var(--color-warning)]">
                  Caps Lock is on
                </p>
              ) : null}
            </div>

            {error ? <Alert message={error} /> : null}

            <Button type="submit" size="lg" fullWidth loading={submitting}>
              {submitting ? 'Signing in…' : (
                <>
                  <LogIn size={15} />
                  Sign in
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--color-muted)]">
            Forgot your password? Ask your administrator to reset it. You can change it
            yourself afterwards from <span className="font-semibold">My profile</span>.
          </p>
        </div>
      </main>
    </div>
  );
}
