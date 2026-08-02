import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  CalendarDays,
  ClipboardList,
  KeyRound,
  Mail,
  Phone,
  Shield,
  UserRound,
} from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/components/ui/Toast';
import { Badge, Card, PageHeader } from '@/components/ui/Page';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const focusPassword = params.get('tab') === 'password';

  const quickActions = useMemo(
    () => [
      { label: 'Dashboard', href: '/dashboard', icon: Activity },
      { label: 'Appointments', href: '/appointments', icon: CalendarDays },
      { label: 'Visits', href: '/visits', icon: ClipboardList },
      { label: 'Attendance', href: '/attendance', icon: Briefcase },
    ],
    [],
  );

  function onPasswordSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.warning('Password too short', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    toast.info(
      'Contact administrator',
      'Password changes for field users are managed by Admin (Reset Password).',
    );
    setPassword('');
    setConfirm('');
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My Profile" description="Account overview, role details and quick actions." />

      <Card className="overflow-hidden p-0">
        <div className="h-36 bg-[linear-gradient(120deg,#0f766e_0%,#134e4a_45%,#0b2e2b_100%)]" />
        <div className="relative px-6 pb-6">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <div className="inline-flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-[var(--color-surface)] bg-[var(--color-primary)] text-2xl font-bold text-white shadow-[var(--shadow-md)]">
              {initials(user?.fullName)}
            </div>
            <div className="pb-1">
              <h2 className="text-2xl font-semibold text-[var(--color-ink)]">{user?.fullName}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge tone="primary">{user?.role}</Badge>
                <Badge tone={user?.status === 'ACTIVE' ? 'success' : 'neutral'}>{user?.status}</Badge>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="space-y-4 p-5 lg:col-span-2">
          <SectionTitle icon={UserRound} title="Basic Information" />
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info label="Full name" value={user?.fullName} />
            <Info label="Email" value={user?.email} icon={Mail} />
            <Info label="Role" value={user?.role} icon={Shield} />
            <Info label="Account status" value={user?.status} />
          </dl>
        </Card>

        <Card className="space-y-4 p-5">
          <SectionTitle icon={Briefcase} title="Quick Actions" />
          <div className="grid gap-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <a
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 py-2.5 text-sm transition hover:bg-[var(--color-bg)]"
                >
                  <Icon size={16} className="text-[var(--color-primary)]" />
                  {action.label}
                </a>
              );
            })}
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <SectionTitle icon={ClipboardList} title="Employee Information" />
          <dl className="space-y-3">
            <Info label="Organization" value="JOVANCE LABORATORIES PVT. LTD." />
            <Info label="Workspace role" value={user?.role === 'ADMIN' ? 'System Administrator' : 'Medical Representative'} />
            <Info label="Joining / access" value="Managed by Admin" />
          </dl>
        </Card>

        <Card className="space-y-4 p-5">
          <SectionTitle icon={Phone} title="Contact Information" />
          <dl className="space-y-3">
            <Info label="Work email" value={user?.email} />
            <Info label="Phone" value="Update via Admin / MR Management" />
          </dl>
        </Card>

        <Card className="space-y-4 p-5">
          <SectionTitle icon={Activity} title="Attendance & Performance" />
          <p className="text-sm text-[var(--color-muted)]">
            Live attendance %, visit counts and sales KPIs are available on Dashboard and Reports for
            your role.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat label="Module" value="Attendance" />
            <MiniStat label="Module" value="Reports" />
          </div>
        </Card>

        <Card className={`space-y-4 p-5 lg:col-span-3 ${focusPassword ? 'ring-2 ring-[var(--color-primary)]/30' : ''}`}>
          <SectionTitle icon={KeyRound} title="Change Password" />
          <form className="grid max-w-xl gap-3 sm:grid-cols-2" onSubmit={onPasswordSubmit}>
            <Input
              label="New password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
            <div className="sm:col-span-2">
              <Button type="submit">Update password request</Button>
            </div>
          </form>
        </Card>

        <Card className="space-y-3 p-5 lg:col-span-3">
          <SectionTitle icon={Activity} title="Recent Activities" />
          <ul className="space-y-2 text-sm">
            <li className="rounded-xl bg-[var(--color-bg)] px-3 py-2">Signed in to Pharma MR CRM</li>
            <li className="rounded-xl bg-[var(--color-bg)] px-3 py-2">
              Role-scoped modules available in the sidebar
            </li>
            <li className="rounded-xl bg-[var(--color-bg)] px-3 py-2">
              Use Dashboard for today’s appointments, visits and sales
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
}: {
  icon: typeof UserRound;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="rounded-lg bg-[var(--color-primary-soft)] p-2 text-[var(--color-primary)]">
        <Icon size={16} />
      </span>
      <h3 className="font-semibold text-[var(--color-ink)]">{title}</h3>
    </div>
  );
}

function Info({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value?: string | null;
  icon?: typeof Mail;
}) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-[var(--color-muted)] uppercase">{label}</dt>
      <dd className="mt-1 flex items-center gap-2 font-medium text-[var(--color-ink)]">
        {Icon ? <Icon size={14} className="text-[var(--color-muted)]" /> : null}
        {value || '—'}
      </dd>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] px-3 py-2">
      <p className="text-[11px] text-[var(--color-muted)]">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}
