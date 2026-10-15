import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, KeyRound, ShieldCheck, X } from 'lucide-react';
import { authApi } from '@/services/auth.service';
import { getApiErrorMessage } from '@/api/client';

/** Mirrors the server DTO so feedback is instant. */
const RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
];

/**
 * Public page reached from an admin-generated reset link:
 * /reset-password?token=<48-hex>. No session required.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [form, setForm] = useState({ next: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const allRulesPass = RULES.every((rule) => rule.test(form.next));
  const matches = form.next.length > 0 && form.next === form.confirm;

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (!allRulesPass) {
      setError('The new password does not meet the requirements');
      return;
    }
    if (!matches) {
      setError('The two passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await authApi.resetPassword({ token, newPassword: form.next });
      setDone(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'This reset link is invalid or has expired'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-[#f4f7f8] px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-[#d3dee1] bg-white p-8 shadow-2xl sm:p-10">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0d5c56]/10 text-[#0d5c56]">
            {done ? <ShieldCheck size={20} /> : <KeyRound size={20} />}
          </span>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#102226]">
              {done ? 'Password updated' : 'Set a new password'}
            </h1>
            <p className="text-xs text-[#617276]">
              {done
                ? 'You can now sign in with your new password.'
                : 'This link works once and expires after 60 minutes.'}
            </p>
          </div>
        </div>

        {done ? (
          <Link
            to="/login"
            className="mt-2 flex h-11 w-full items-center justify-center rounded-xl bg-[#0d5c56] px-4 text-sm font-bold text-white shadow-md transition-all hover:bg-[#0a4a45]"
          >
            Go to sign in
          </Link>
        ) : !token ? (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs font-medium text-amber-800">
            This page needs the reset link your administrator generated for you — the token in
            the address is missing. Ask them to create a fresh link.
          </p>
        ) : (
          <form onSubmit={(event) => void onSubmit(event)} className="space-y-4">
            <label className="block text-sm font-semibold text-[#102226]">
              New password
              <input
                type="password"
                required
                autoComplete="new-password"
                value={form.next}
                onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-xl border border-[#d3dee1] bg-white px-3.5 text-sm text-[#102226] shadow-xs outline-none transition-all focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/15"
              />
            </label>
            <label className="block text-sm font-semibold text-[#102226]">
              Confirm new password
              <input
                type="password"
                required
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                className="mt-1.5 h-11 w-full rounded-xl border border-[#d3dee1] bg-white px-3.5 text-sm text-[#102226] shadow-xs outline-none transition-all focus:border-[#0f766e] focus:ring-4 focus:ring-[#0f766e]/15"
              />
            </label>

            <ul className="space-y-1 rounded-xl border border-[#d3dee1] bg-[#f4f7f8] p-3">
              {[...RULES, { label: 'Both passwords match', test: () => matches }].map((rule) => {
                const ok = rule.test(form.next);
                return (
                  <li key={rule.label} className="flex items-center gap-1.5 text-[11px] font-medium">
                    <span
                      aria-hidden
                      className={
                        ok
                          ? 'flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-600 text-white'
                          : 'flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#c4d0d4] text-white'
                      }
                    >
                      {ok ? <Check size={9} strokeWidth={4} /> : <X size={9} strokeWidth={4} />}
                    </span>
                    <span className={ok ? 'text-emerald-700' : 'text-[#617276]'}>{rule.label}</span>
                  </li>
                );
              })}
            </ul>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-[#be123c]">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !allRulesPass || !matches}
              className="flex h-11 w-full items-center justify-center rounded-xl bg-[#0d5c56] px-4 text-sm font-bold text-white shadow-md transition-all hover:bg-[#0a4a45] disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'Saving…' : 'Reset password'}
            </button>

            <p className="text-center text-xs text-[#617276]">
              Changed your mind?{' '}
              <Link to="/login" className="font-semibold text-[#0d5c56] hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
