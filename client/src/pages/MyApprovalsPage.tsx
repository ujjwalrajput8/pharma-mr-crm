import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronRight, ClipboardCheck, ListChecks, Map, Plane, Wallet } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { myApprovalsApi, type ApprovalKind, type MyApprovalItem } from '@/services/msl.service';
import { formatDisplayDate } from '@/utils/datetime';

type Tab = 'all' | ApprovalKind;
const KINDS: Array<{ value: ApprovalKind; label: string; icon: typeof Map }> = [
  { value: 'tour-plan', label: 'Monthly Tour Plan', icon: Map },
  { value: 'expense', label: 'Expense', icon: Wallet },
  { value: 'msl', label: 'MSL', icon: ListChecks },
  { value: 'leave', label: 'Leave', icon: Plane },
];
const TONE: Record<MyApprovalItem['status'], 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
  OTHER: 'neutral',
};
const LABEL: Record<MyApprovalItem['status'], string> = {
  PENDING: 'Waiting',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  OTHER: '—',
};

/** MR "Approval" (client note): status of every request the MR sent — read only. */
export function MyApprovalsPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('kind') as Tab | null;
  const tab: Tab = requested && KINDS.some((k) => k.value === requested) ? requested : 'all';
  const query = useQuery({ queryKey: ['my-approvals'], queryFn: () => myApprovalsApi.list() });
  const items = (query.data?.items ?? []).filter((i) => tab === 'all' || i.kind === tab);
  const pending = query.data?.pending;
  const allPending = pending ? Object.values(pending).reduce((a, b) => a + b, 0) : undefined;

  return (
    <div className="space-y-5">
      <PageHeader title="Approval" description="Where your tour plans, expenses, MSL requests and leave stand." />
      <Tabs
        variant="page"
        ariaLabel="Approval kind"
        items={[
          { value: 'all', label: 'All', icon: ClipboardCheck, count: allPending || undefined },
          ...KINDS.map((k) => ({ value: k.value, label: k.label, icon: k.icon, count: pending?.[k.value] || undefined })),
        ]}
        value={tab}
        onChange={(next) => setParams(next === 'all' ? {} : { kind: next })}
      />
      {query.isError ? <Alert message={getApiErrorMessage(query.error)} /> : null}
      <Card>
        {query.isLoading ? <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">Loading…</p> : null}
        {!query.isLoading && items.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Nothing here yet" description="What you send for approval shows up here with its status." />
          </div>
        ) : null}
        <ul className="divide-y divide-[var(--color-border)]" data-testid="my-approvals">
          {items.map((i) => (
            <li key={`${i.kind}-${i.id}`} data-testid="approval-item">
              <Link to={i.href} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-[var(--color-surface-subtle)]/60">
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-[var(--color-ink)]">{i.title}</span>
                  <span className="block text-xs text-[var(--color-muted)]">
                    {i.detail}
                    {i.submittedAt ? ` · sent ${formatDisplayDate(i.submittedAt.slice(0, 10))}` : ''}
                  </span>
                  {i.decidedBy && i.status !== 'PENDING' ? (
                    <span className="block text-xs text-[var(--color-muted)]">
                      {LABEL[i.status]} by {i.decidedBy}
                      {i.note ? ` — “${i.note}”` : ''}
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={TONE[i.status]}>{LABEL[i.status]}</Badge>
                  <ChevronRight size={15} className="text-[var(--color-muted)]" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
