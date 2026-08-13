import { useMemo, useState } from 'react';
import { CheckCircle2, MapPin, Play } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Field';
import { Alert, Badge, Card, CardHeader, EmptyState, PageHeader, StatTile } from '@/components/ui/Page';
import { MOCK_CALL_LIST, type MockCall } from '@/mocks/fieldForce';
import { cn } from '@/utils/cn';

type DayPhase = 'not_started' | 'checked_in' | 'closed';

const priorityTone: Record<MockCall['priority'], 'danger' | 'warning' | 'neutral'> = {
  A: 'danger',
  B: 'warning',
  C: 'neutral',
};

export function MyDayPage() {
  const [phase, setPhase] = useState<DayPhase>('not_started');
  const [calls, setCalls] = useState(MOCK_CALL_LIST);
  const [activeCall, setActiveCall] = useState<MockCall | null>(null);
  const [dcrNotes, setDcrNotes] = useState('');
  const [flagNote, setFlagNote] = useState<string | null>(null);
  const [dayCloseOpen, setDayCloseOpen] = useState(false);

  const stats = useMemo(() => {
    const done = calls.filter((c) => c.status === 'done').length;
    const pending = calls.filter((c) => c.status === 'pending').length;
    return { done, pending, total: calls.length };
  }, [calls]);

  function handleCheckIn(): void {
    const flagged = Math.random() < 0.15;
    setFlagNote(
      flagged
        ? 'Check-in flagged (low GPS confidence). Manager can approve later — day continues.'
        : null,
    );
    setPhase('checked_in');
  }

  function completeVisit(): void {
    if (!activeCall) return;
    setCalls((prev) =>
      prev.map((c) => (c.id === activeCall.id ? { ...c, status: 'done' as const } : c)),
    );
    setActiveCall(null);
    setDcrNotes('');
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="My Day"
        description="Check-in → call list → visit / DCR → day close."
        actions={
          phase === 'checked_in' ? (
            <Button variant="secondary" onClick={() => setDayCloseOpen(true)}>
              Day close
            </Button>
          ) : null
        }
      />

      {flagNote ? <Alert message={flagNote} tone="warning" /> : null}

      {phase === 'not_started' ? (
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                Start of day
              </p>
              <h3 className="mt-1 text-lg font-semibold tracking-tight">Check in to begin</h3>
              <p className="mt-1 max-w-md text-sm text-[var(--color-muted)]">
                GPS and device time are stored. Poor accuracy only flags the entry — it never blocks
                fieldwork.
              </p>
            </div>
            <Button onClick={handleCheckIn}>
              <MapPin size={15} />
              Check in
            </Button>
          </div>
        </Card>
      ) : null}

      {phase === 'checked_in' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile label="Planned" value={stats.total} />
            <StatTile label="Completed" value={stats.done} />
            <StatTile label="Pending" value={stats.pending} />
          </div>

          <Card>
            <CardHeader
              title="Today's call list"
              description="From approved tour plan (preview data)"
            />
            {calls.length === 0 ? (
              <EmptyState title="No calls planned" description="Submit a tour plan for this week." />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {calls.map((call) => (
                  <li
                    key={call.id}
                    className={cn(
                      'flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between',
                      call.status === 'done' && 'bg-[var(--color-success-soft)]/50',
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{call.doctorName}</p>
                        <Badge tone={priorityTone[call.priority]}>Cat {call.priority}</Badge>
                        {call.hasAppointment ? <Badge tone="primary">Appt</Badge> : null}
                        {call.status === 'done' ? <Badge tone="success">Done</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-sm text-[var(--color-muted)]">
                        {call.speciality} · {call.clinic}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-[var(--color-muted)]">
                        {call.slot}
                        {call.lastVisit ? ` · last ${call.lastVisit}` : ' · first visit'}
                      </p>
                    </div>
                    {call.status === 'pending' ? (
                      <Button size="sm" onClick={() => setActiveCall(call)}>
                        <Play size={13} />
                        Start
                      </Button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--color-success)]">
                        <CheckCircle2 size={14} /> Logged
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      {phase === 'closed' ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto text-[var(--color-success)]" size={28} />
          <p className="mt-3 text-base font-semibold">Day closed</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            Submitted for manager review. Sync/lock wires in backend phase.
          </p>
          <Button className="mt-4" variant="secondary" size="sm" onClick={() => setPhase('not_started')}>
            Reset preview
          </Button>
        </Card>
      ) : null}

      <Modal
        open={Boolean(activeCall)}
        onClose={() => setActiveCall(null)}
        title={activeCall ? `Visit — ${activeCall.doctorName}` : 'Visit'}
        description="DCR preview. Samples will post to stock ledger when backend is connected."
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setActiveCall(null)}>
              Cancel
            </Button>
            <Button onClick={completeVisit}>Save DCR</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-xs text-[var(--color-muted)]">
            In-time: now · Out-time: on save · Distance: mock
          </div>
          <Textarea
            label="Discussion / feedback"
            value={dcrNotes}
            onChange={(e) => setDcrNotes(e.target.value)}
            placeholder="Products detailed, doctor feedback, next follow-up…"
          />
        </div>
      </Modal>

      <Modal
        open={dayCloseOpen}
        onClose={() => setDayCloseOpen(false)}
        title="Day close"
        description="Summary before manager review."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDayCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setDayCloseOpen(false);
                setPhase('closed');
              }}
            >
              Submit day
            </Button>
          </>
        }
      >
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between border-b border-[var(--color-border)] py-2">
            <dt className="text-[var(--color-muted)]">Visits completed</dt>
            <dd className="font-medium tabular-nums">
              {stats.done} / {stats.total}
            </dd>
          </div>
          <div className="flex justify-between py-2">
            <dt className="text-[var(--color-muted)]">Pending sync</dt>
            <dd className="font-medium">0</dd>
          </div>
        </dl>
      </Modal>
    </div>
  );
}
