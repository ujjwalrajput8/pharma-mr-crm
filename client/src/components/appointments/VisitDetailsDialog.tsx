import type { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui/Page';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Visit } from '@/services/visits.service';
import { addMinutesToHHmm, formatDisplayDate, formatTime12, shortId } from '@/utils/datetime';
import { unpackVisitRemarks } from '@/utils/fieldMeta';

interface VisitDetailsDialogProps {
  open: boolean;
  visit: Visit | null;
  onClose: () => void;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-[var(--color-border)] py-2 text-sm last:border-0">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="col-span-2 font-medium text-[var(--color-ink)]">{value || '—'}</dd>
    </div>
  );
}

export function VisitDetailsDialog({ open, visit, onClose }: VisitDetailsDialogProps) {
  if (!visit) return null;
  const { text, meta } = unpackVisitRemarks(visit.remarks);
  const checkIn = visit.checkInTime ?? meta.checkIn ?? visit.visitTime ?? '';
  const checkOut =
    visit.checkOutTime ??
    meta.checkOut ??
    (visit.visitTime && visit.meetingDurationMin
      ? addMinutesToHHmm(visit.visitTime, visit.meetingDurationMin)
      : '');
  const outcome = visit.visitOutcome ?? meta.outcome ?? '';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Visit Details"
      description="Actual meeting record linked to an appointment"
      className="max-w-2xl"
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        <Card className="border-0 p-1 shadow-none">
          <dl>
            <Row
              label="Appointment No."
              value={visit.appointmentId ? `#${shortId(visit.appointmentId)}` : '—'}
            />
            <Row label="Doctor" value={visit.doctor?.fullName} />
            <Row label="MR" value={visit.mr?.fullName} />
            <Row label="Date" value={formatDisplayDate(visit.visitDate)} />
            <Row label="Visit Time" value={visit.visitTime ? formatTime12(visit.visitTime) : '—'} />
            <Row label="Check-in" value={checkIn ? formatTime12(checkIn) : '—'} />
            <Row label="Check-out" value={checkOut ? formatTime12(checkOut) : '—'} />
            <Row label="Duration" value={visit.meetingDurationMin ? `${visit.meetingDurationMin} min` : '—'} />
            <Row label="Discussion Summary" value={visit.discussionNotes} />
            <Row label="Doctor Feedback" value={visit.doctorFeedback} />
            <Row label="Outcome" value={outcome} />
            <Row
              label="Next Follow-up"
              value={visit.nextFollowUp ? formatDisplayDate(visit.nextFollowUp) : '—'}
            />
            <Row label="Remarks" value={text} />
          </dl>
        </Card>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Products Discussed</h4>
          {visit.products.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">None</p>
          ) : (
            <ul className="space-y-1">
              {visit.products.map((p) => (
                <li key={p.id} className="rounded-xl bg-[var(--color-bg)] px-3 py-2 text-sm">
                  <span className="font-medium">{p.name}</span>
                  {p.notes ? <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{p.notes}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-2 text-sm font-semibold text-[var(--color-ink)]">Samples Distributed</h4>
          {visit.distributions.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">None</p>
          ) : (
            <ul className="space-y-1">
              {visit.distributions.map((d) => (
                <li key={d.id} className="flex items-center justify-between rounded-xl bg-[var(--color-bg)] px-3 py-2 text-sm">
                  <span>
                    {d.medicineName}
                    {d.batchNumber ? (
                      <span className="ml-2 text-xs text-[var(--color-muted)]">Batch {d.batchNumber}</span>
                    ) : null}
                  </span>
                  <Badge tone="primary">Qty {d.quantity}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
