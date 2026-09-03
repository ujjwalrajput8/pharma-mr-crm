import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  IdCard,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  Timer,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';
import { Meter } from '@/components/ui/Meter';
import { Modal, FormSection } from '@/components/ui/Modal';
import {
  Alert,
  Badge,
  Card,
  DetailRow,
  PageHeader,
  SectionCard,
  StatTile,
} from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { authApi } from '@/services/auth.service';
import { employeesApi } from '@/services/employees.service';
import { formatDisplayDate } from '@/utils/datetime';

/** Live rules mirrored from the server DTO so feedback is instant. */
const RULES: Array<{ label: string; test: (value: string) => boolean }> = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v) => /[0-9]/.test(v) },
];

export function ProfilePage() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // The header menu deep-links straight into the dialog: ?change-password=1
  const [passwordOpen, setPasswordOpen] = useState(
    () => params.get('change-password') === '1',
  );
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState<string | null>(null);

  function closePasswordDialog(): void {
    setPasswordOpen(false);
    setError(null);
    if (params.has('change-password')) {
      params.delete('change-password');
      setParams(params, { replace: true });
    }
  }

  const profileQuery = useQuery({
    queryKey: ['employee', 'me'],
    queryFn: () => employeesApi.me(),
    // Admin accounts have no employee record; a 403/404 here is not an error state.
    retry: false,
  });
  const profile = profileQuery.data;

  const changeMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword({ currentPassword: form.current, newPassword: form.next }),
    onSuccess: async () => {
      setPasswordOpen(false);
      setForm({ current: '', next: '', confirm: '' });
      setError(null);
      toast.success('Password changed', 'Sign in again with your new password.');
      await logout();
      navigate('/login', { replace: true });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const allRulesPass = RULES.every((rule) => rule.test(form.next));
  const matches = form.next.length > 0 && form.next === form.confirm;

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!form.current) {
      setError('Enter your current password');
      return;
    }
    if (!allRulesPass) {
      setError('New password does not meet the requirements below');
      return;
    }
    if (!matches) {
      setError('The two new passwords do not match');
      return;
    }
    changeMutation.mutate();
  }

  const paidBalances = (profile?.leave.balances ?? []).filter((b) => b.isPaid && !b.unlimited);

  return (
    <div className="space-y-5">
      <PageHeader
        title="My profile"
        description="Your account, employment record and leave position."
        actions={
          <>
            {profile ? (
              <Link to={`/employees/${profile.id}`}>
                <Button variant="ghost">
                  <IdCard size={15} />
                  Full record
                  <ChevronRight size={13} />
                </Button>
              </Link>
            ) : null}
            <Button onClick={() => setPasswordOpen(true)}>
              <KeyRound size={15} />
              Change password
            </Button>
          </>
        }
      />

      {/* ── Identity ─────────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar
              name={user?.fullName ?? '?'}
              photoUrl={profile?.personal.photoUrl}
              size="xl"
            />
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-[var(--color-ink)]">
                {user?.fullName}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <Badge tone="primary">{user?.role}</Badge>
                <Badge tone={user?.status === 'ACTIVE' ? 'success' : 'danger'}>
                  {user?.status}
                </Badge>
                {profile?.employment.employeeCode ? (
                  <span className="font-mono text-[11px] text-[var(--color-muted)]">
                    {profile.employment.employeeCode}
                  </span>
                ) : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} /> {user?.email}
                </span>
                {profile?.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={13} /> {profile.phone}
                  </span>
                ) : null}
                {profile?.employment.assignedArea ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} /> {profile.employment.assignedArea}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {profile?.manager ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-4 py-3">
              <p className="text-[10px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                Reports to
              </p>
              <p className="mt-1 flex items-center gap-2 text-sm font-semibold">
                <Avatar name={profile.manager.fullName} size="sm" />
                {profile.manager.fullName}
              </p>
            </div>
          ) : null}
        </div>
      </Card>

      {/* ── Live figures ─────────────────────────────────────────────────── */}
      {profile ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Present this month"
              value={profile.attendance.month.present + profile.attendance.month.late}
              hint={`${profile.attendance.month.late} late · ${profile.attendance.month.absent} absent`}
              icon={CalendarDays}
              tone="success"
            />
            <StatTile
              label="Hours logged"
              value={`${profile.attendance.month.workingHours} h`}
              hint="This month"
              icon={Timer}
            />
            <StatTile
              label="Leave left"
              value={profile.leave.totals.remaining}
              hint={`${profile.leave.totals.used} of ${profile.leave.totals.entitled} used`}
              icon={Clock3}
              tone="primary"
            />
            <StatTile
              label="Awaiting approval"
              value={profile.leave.totals.pending}
              hint="Days in pending requests"
              icon={Clock3}
              tone={profile.leave.totals.pending > 0 ? 'warning' : 'neutral'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Employment" icon={BriefcaseBusiness}>
              <dl>
                <DetailRow label="Employee code" value={profile.employment.employeeCode} mono />
                <DetailRow label="Designation" value={profile.employment.designation} />
                <DetailRow
                  label="Joining date"
                  value={
                    profile.employment.joiningDate
                      ? formatDisplayDate(profile.employment.joiningDate)
                      : null
                  }
                />
                <DetailRow label="Beat / area" value={profile.employment.assignedArea} />
                <DetailRow label="Territory" value={profile.territory?.name} />
                <DetailRow
                  label="Direct reports"
                  value={profile.directReports > 0 ? profile.directReports : null}
                />
              </dl>
            </SectionCard>

            <SectionCard
              title={`Leave balance — ${profile.leave.year}`}
              description="Used days come from approved requests only"
              icon={Clock3}
            >
              {paidBalances.length === 0 ? (
                <p className="py-3 text-xs text-[var(--color-muted)]">
                  No leave policy configured yet — ask an administrator to set it up.
                </p>
              ) : (
                <div className="space-y-3">
                  {paidBalances.map((balance) => (
                    <div key={balance.leaveTypeId}>
                      <div className="flex items-center justify-between gap-3 text-xs">
                        <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: balance.colorHex }}
                            aria-hidden
                          />
                          <span className="truncate">{balance.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
                          {balance.remaining} of {balance.entitled} left
                        </span>
                      </div>
                      <Meter
                        className="mt-1.5"
                        value={balance.used}
                        total={balance.entitled}
                        pending={balance.pending}
                        color={balance.colorHex}
                      />
                    </div>
                  ))}
                  <Link
                    to="/leave"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary)] hover:underline"
                  >
                    Apply for leave
                    <ChevronRight size={12} />
                  </Link>
                </div>
              )}
            </SectionCard>
          </div>
        </>
      ) : (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Shield size={17} />
            </span>
            <div>
              <p className="text-sm font-bold text-[var(--color-ink)]">Workspace account</p>
              <p className="mt-1 max-w-lg text-xs leading-relaxed text-[var(--color-muted)]">
                Administrator accounts have no employee record — no attendance, leave balance or
                beat. Use Employees to open any field user&apos;s record.
              </p>
              <Link to="/employees" className="mt-3 inline-block">
                <Button size="sm" variant="secondary">
                  <IdCard size={14} />
                  Employee directory
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* ── Change password ──────────────────────────────────────────────── */}
      <Modal
        open={passwordOpen}
        onClose={closePasswordDialog}
        title="Change password"
        description="You will be signed out of every device once it changes."
        icon={ShieldCheck}
        className="max-w-md"
      >
        <form onSubmit={onSubmit} className="space-y-5">
          {error ? <Alert message={error} /> : null}

          <FormSection title="Current" icon={KeyRound}>
            <Input
              label="Current password"
              type="password"
              required
              autoComplete="current-password"
              value={form.current}
              onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))}
              placeholder="Enter your existing password"
            />
          </FormSection>

          <FormSection title="New password" icon={ShieldCheck}>
            <div className="space-y-3.5">
              <Input
                label="New password"
                type="password"
                required
                autoComplete="new-password"
                value={form.next}
                onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))}
              />
              <Input
                label="Confirm new password"
                type="password"
                required
                autoComplete="new-password"
                value={form.confirm}
                onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))}
                error={
                  form.confirm.length > 0 && !matches ? 'Passwords do not match' : null
                }
              />

              <ul className="grid gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/50 p-3 sm:grid-cols-2">
                {RULES.map((rule) => {
                  const ok = rule.test(form.next);
                  return (
                    <li
                      key={rule.label}
                      className="flex items-center gap-1.5 text-[11px] font-medium"
                    >
                      <span
                        className={
                          ok
                            ? 'flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-success)] text-white'
                            : 'flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-border-strong)] text-[var(--color-surface)]'
                        }
                        aria-hidden
                      >
                        {ok ? <Check size={9} strokeWidth={4} /> : <X size={9} strokeWidth={4} />}
                      </span>
                      <span
                        className={
                          ok ? 'text-[var(--color-success)]' : 'text-[var(--color-muted)]'
                        }
                      >
                        {rule.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </FormSection>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={closePasswordDialog}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={changeMutation.isPending}
              disabled={!allRulesPass || !matches || !form.current}
            >
              <ShieldCheck size={14} />
              Update password
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
