import { useAuth } from '@/store/AuthContext';
import { Badge, Card, PageHeader } from '@/components/ui/Page';

export function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="max-w-xl space-y-5">
      <PageHeader title="Profile" description="Your account details for this workspace." />
      <Card className="p-6">
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="text-[var(--color-muted)]">Full name</dt>
            <dd className="mt-1 font-medium">{user?.fullName}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Email</dt>
            <dd className="mt-1 font-medium">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Role</dt>
            <dd className="mt-1">
              <Badge tone="primary">{user?.role}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Status</dt>
            <dd className="mt-1">
              <Badge tone={user?.status === 'ACTIVE' ? 'success' : 'neutral'}>{user?.status}</Badge>
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
