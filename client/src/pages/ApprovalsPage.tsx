import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge, Card, EmptyState, PageHeader, StatTile } from '@/components/ui/Page';
import { MOCK_APPROVALS, type MockApproval } from '@/mocks/fieldForce';

const kindLabel: Record<MockApproval['kind'], string> = {
  tour_plan: 'Tour plan',
  attendance_flag: 'Attendance',
  doctor_request: 'Doctor',
  expense: 'Expense',
};

export function ApprovalsPage() {
  const [items, setItems] = useState(MOCK_APPROVALS);
  const pending = items.filter((i) => i.status === 'pending');

  function act(id: string, status: 'approved' | 'rejected'): void {
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, status } : row)));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Approvals"
        description="Tour plans, flagged attendance, doctor requests, and expenses."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Pending" value={pending.length} />
        <StatTile
          label="Approved"
          value={items.filter((i) => i.status === 'approved').length}
        />
        <StatTile
          label="Rejected"
          value={items.filter((i) => i.status === 'rejected').length}
        />
      </div>

      <Card>
        {pending.length === 0 ? (
          <EmptyState title="Inbox clear" description="No pending approvals." />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {pending.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="primary">{kindLabel[item.kind]}</Badge>
                    <p className="text-sm font-semibold">{item.title}</p>
                  </div>
                  <p className="mt-1 text-sm text-[var(--color-muted)]">{item.subtitle}</p>
                  <p className="mt-1 font-mono text-[11px] text-[var(--color-muted)]">
                    {item.requestedBy} · {item.requestedAt}
                  </p>
                </div>
                <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => act(item.id, 'rejected')}
                  >
                    Reject
                  </Button>
                  <Button size="sm" className="w-full sm:w-auto" onClick={() => act(item.id, 'approved')}>
                    Approve
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
