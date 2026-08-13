import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge, Card, PageHeader } from '@/components/ui/Page';
import { MOCK_TOUR_DAYS, type MockTourDay } from '@/mocks/fieldForce';

const statusTone: Record<MockTourDay['status'], 'neutral' | 'primary' | 'success' | 'danger'> = {
  draft: 'neutral',
  submitted: 'primary',
  approved: 'success',
  rejected: 'danger',
};

export function TourPlanPage() {
  const [status, setStatus] = useState<'draft' | 'submitted' | 'approved'>('draft');
  const [days] = useState(MOCK_TOUR_DAYS);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tour plan"
        description="Monthly plan → manager approval → day-wise call list."
        actions={
          status === 'draft' ? (
            <Button onClick={() => setStatus('submitted')}>Submit</Button>
          ) : status === 'submitted' ? (
            <Button variant="secondary" onClick={() => setStatus('approved')}>
              Preview approve
            </Button>
          ) : (
            <Badge tone="success">Approved</Badge>
          )
        }
      />

      <Card className="flex flex-wrap items-end justify-between gap-3 px-4 py-3.5">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
            Plan month
          </p>
          <p className="mt-1 text-base font-semibold">August 2026</p>
        </div>
        <Badge tone={statusTone[status]}>{status}</Badge>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {days.map((day) => (
          <Card key={day.date} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold tabular-nums">{day.date}</p>
                <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                  {day.beat} · {day.workType}
                </p>
              </div>
              <Badge tone={statusTone[day.status]}>{day.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-[var(--color-ink)]">
              {day.doctors.length > 0 ? day.doctors.join(', ') : 'No doctor calls'}
            </p>
          </Card>
        ))}
      </div>
    </div>
  );
}
