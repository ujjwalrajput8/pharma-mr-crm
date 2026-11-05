import { useState } from 'react';
import { ArrowRight, CalendarClock, ClipboardList, Route, UserRoundCog } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import type { AssignmentMove } from '@/services/doctors.service';

function MrCard({ title, mr }: { title: string; mr: AssignmentMove['from'] | null }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-3">
      <p className="text-[10px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase">{title}</p>
      <p className="mt-1 truncate text-sm font-semibold text-[var(--color-ink)]">{mr ? mr.fullName : 'No MR'}</p>
      {mr?.employeeCode ? <p className="font-mono text-[11px] text-[var(--color-muted)]">{mr.employeeCode}</p> : null}
      {mr?.team ? <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-muted)]">{mr.team}</p> : null}
    </div>
  );
}

/**
 * "Move Dr. X from Neha to Rahul?" — shows who has the doctor now, who gets them,
 * and what stays with the old MR (nothing is moved, cancelled or deleted).
 */
export function MoveConfirmDialog({
  moves,
  loading,
  onCancel,
  onConfirm,
}: {
  moves: AssignmentMove[] | null;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  if (!moves) return null;
  const one = moves.length === 1 ? moves[0]! : null;
  return (
    <Modal
      open
      title={one ? `Move ${one.doctorName}?` : `Move ${moves.length} doctors?`}
      description="The doctor changes MR. Their history stays where it is."
      icon={UserRoundCog}
      badge="Confirm"
      onClose={onCancel}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(note.trim())} loading={loading} data-testid="confirm-move">
            {one ? 'Move doctor' : `Move ${moves.length} doctors`}
          </Button>
        </>
      }
    >
      <div className="space-y-4" data-testid="move-confirm">
        {one ? (
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <MrCard title="From" mr={one.from} />
            <ArrowRight size={18} className="mx-auto shrink-0 rotate-90 text-[var(--color-muted)] sm:rotate-0" />
            <MrCard title="To" mr={one.to} />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]">
            {moves.map((m) => (
              <li key={m.doctorId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
                <span className="font-semibold text-[var(--color-ink)]">{m.doctorName}</span>
                <span className="text-[var(--color-muted)]">
                  {m.from.fullName} → {m.to?.fullName ?? 'No MR'}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-xl bg-[var(--color-surface-subtle)] p-3">
          <p className="mb-2 text-[11px] font-semibold text-[var(--color-ink)]/80">Stays with the old MR — nothing is moved or deleted</p>
          <ul className="space-y-1.5 text-[12.5px] text-[var(--color-ink)]">
            <li className="flex items-center gap-2">
              <CalendarClock size={14} className="text-[var(--color-muted)]" />
              {sum(moves, 'pendingAppointments')} pending appointment(s)
            </li>
            <li className="flex items-center gap-2">
              <Route size={14} className="text-[var(--color-muted)]" />
              {sum(moves, 'planCalls')} tour plan call(s) this month
            </li>
            <li className="flex items-center gap-2">
              <ClipboardList size={14} className="text-[var(--color-muted)]" />
              {sum(moves, 'visits')} past visit(s)
            </li>
          </ul>
        </div>
        <Textarea
          label="Note for the history"
          optional
          maxLength={500}
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Area realigned in the November review"
        />
      </div>
    </Modal>
  );
}

function sum(moves: AssignmentMove[], key: 'pendingAppointments' | 'planCalls' | 'visits') {
  return moves.reduce((total, m) => total + m[key], 0);
}
