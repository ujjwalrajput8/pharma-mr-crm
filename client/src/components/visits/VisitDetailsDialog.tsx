import { useQuery } from '@tanstack/react-query';
import { ClipboardList, History, MapPin, PackageCheck, PackageMinus, ShieldCheck, Stethoscope } from 'lucide-react';
import { Badge } from '@/components/ui/Page';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { purposeLabel, visitsApi, type Visit, type VisitHistoryEntry } from '@/services/visits.service';
import { formatDisplayDate } from '@/utils/datetime';

const ACTION_LABEL: Record<string, string> = {
  VISIT_CREATED: 'Logged',
  VISIT_CORRECTED: 'Corrected',
  VISIT_SAMPLE_CORRECTED: 'Samples corrected',
  VISIT_REVIEWED: 'Reviewed',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-[13px]">
      <span className="w-32 shrink-0 text-[var(--color-muted)]">{label}</span>
      <span className="min-w-0 flex-1 text-[var(--color-ink)]">{children}</span>
    </div>
  );
}

function changeText(entry: VisitHistoryEntry): string {
  if (entry.action === 'VISIT_CORRECTED' && entry.after) {
    return Object.keys(entry.after)
      .map((key) => `${key}: ${String((entry.before as Record<string, unknown> | null)?.[key] ?? '—')} → ${String((entry.after as Record<string, unknown>)[key] ?? '—')}`)
      .join(' · ');
  }
  if (entry.action === 'VISIT_SAMPLE_CORRECTED') {
    const lines = ((entry.after as { lines?: Array<{ action: string; qty: number }> } | null)?.lines ?? []);
    return lines.map((l) => `${l.action.replace(/_/g, ' ').toLowerCase()} ${l.qty}`).join(' · ');
  }
  if (entry.action === 'VISIT_REVIEWED') return String((entry.after as { action?: string } | null)?.action ?? '').toLowerCase();
  return '';
}

/** A visit with everything around it: samples (net), review and the full correction history. */
export function VisitDetailsDialog({
  visitId,
  onClose,
  onCorrect,
  onCorrectSamples,
  onReview,
}: {
  visitId: number | null;
  onClose: () => void;
  onCorrect?: (visit: Visit) => void;
  onCorrectSamples?: (visit: Visit) => void;
  onReview?: (visit: Visit) => void;
}) {
  const visit = useQuery({ queryKey: ['visits', 'one', visitId], queryFn: () => visitsApi.get(visitId!), enabled: visitId != null });
  const history = useQuery({ queryKey: ['visits', 'history', visitId], queryFn: () => visitsApi.history(visitId!), enabled: visitId != null });
  if (visitId == null) return null;
  const v = visit.data;
  return (
    <Modal
      open
      title={v?.doctor ? v.doctor.fullName : 'Visit'}
      description={v ? `${formatDisplayDate(v.visitDate)} · ${v.visitTime ?? ''} · ${v.mr?.fullName ?? ''}` : 'Loading…'}
      icon={ClipboardList}
      onClose={onClose}
      className="max-w-2xl"
      footer={
        v ? (
          <>
            {v.can.review && onReview ? (
              <Button variant="soft" onClick={() => onReview(v)}>
                Review
              </Button>
            ) : null}
            {v.can.correctSamples && onCorrectSamples && v.distributions.length > 0 ? (
              <Button variant="secondary" onClick={() => onCorrectSamples(v)}>
                Sample correction
              </Button>
            ) : null}
            {v.can.correct && onCorrect ? <Button onClick={() => onCorrect(v)}>Correct visit</Button> : null}
          </>
        ) : null
      }
    >
      {!v ? (
        <p className="text-sm text-[var(--color-muted)]">Loading…</p>
      ) : (
        <div className="space-y-5" data-testid="visit-details">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={v.source === 'DIRECT' ? 'primary' : 'neutral'}>{v.source === 'DIRECT' ? 'Direct' : 'From appointment'}</Badge>
            {v.offList ? <Badge tone="warning">{v.review ? `Unlisted · ${v.review.action?.toLowerCase()}` : 'Unlisted · review pending'}</Badge> : null}
            {v.lastCorrectedAt ? <Badge tone="neutral">Corrected</Badge> : null}
          </div>
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/50 px-4 py-2">
            {v.doctor ? (
              <Row label="Doctor">
                <span className="flex items-center gap-1.5 font-semibold"><Stethoscope size={13} />{v.doctor.fullName}</span>
                <span className="block text-[12px] text-[var(--color-muted)]">{[v.doctor.mslNo ? `MSL ${v.doctor.mslNo}` : null, v.doctor.specialization, v.doctor.area].filter(Boolean).join(' · ')}</span>
                {v.doctor.address ? <span className="flex items-start gap-1 text-[12px] text-[var(--color-muted)]"><MapPin size={12} className="mt-0.5" />{v.doctor.address}</span> : null}
              </Row>
            ) : null}
            <Row label="Time">{[v.checkInTime, v.checkOutTime].filter(Boolean).join(' – ') || v.visitTime}{v.meetingDurationMin ? ` · ${v.meetingDurationMin} min` : ''}</Row>
            <Row label="Purpose">{purposeLabel(v.purpose)}</Row>
            {v.products.length ? (
              <Row label="Products">
                {v.products.map((p) => (
                  <span key={p.id} className="block">
                    {p.name}
                    {p.interestLevel ? ` · ${p.interestLevel.toLowerCase()} interest` : ''}
                    {p.prescriptionExpected ? ' · Rx expected' : ''}
                  </span>
                ))}
              </Row>
            ) : null}
            {v.discussionNotes ? <Row label="Notes">{v.discussionNotes}</Row> : null}
            {v.doctorFeedback ? <Row label="Feedback">{v.doctorFeedback}</Row> : null}
            {v.visitOutcome ? <Row label="Outcome">{v.visitOutcome.replace(/_/g, ' ').toLowerCase()}</Row> : null}
            {v.nextFollowUp ? <Row label="Follow-up">{formatDisplayDate(v.nextFollowUp)}</Row> : null}
            {v.remarks ? <Row label="Remarks">{v.remarks}</Row> : null}
            {v.appointment ? <Row label="Appointment">#{v.appointment.id} · {v.appointment.status.toLowerCase()}</Row> : null}
          </div>

          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase"><PackageCheck size={13} /> Samples</h4>
            {v.distributions.length === 0 ? (
              <p className="text-[12.5px] text-[var(--color-muted)]">No samples on this visit.</p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)]" data-testid="visit-samples">
                {v.distributions.map((s) => (
                  <li key={`${s.medicineId}-${s.batchId}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]">
                    <span>
                      <span className="font-semibold text-[var(--color-ink)]">{s.medicineName}</span>
                      <span className="ml-1.5 text-[11px] text-[var(--color-muted)]">batch {s.batchNumber}</span>
                    </span>
                    <span className="flex items-center gap-2 tabular-nums">
                      <span className="font-semibold text-[var(--color-ink)]" data-testid="sample-net">{s.quantity}</span>
                      {s.returned || s.writtenOff ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--color-muted)]">
                          <PackageMinus size={11} /> given {s.given} · back {s.returned} · written off {s.writtenOff}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {v.review ? (
            <p className="flex items-center gap-1.5 text-[12.5px] text-[var(--color-muted)]">
              <ShieldCheck size={13} /> Reviewed by {v.review.by?.fullName ?? '—'} · {v.review.action?.toLowerCase()}
              {v.review.note ? ` · “${v.review.note}”` : ''}
            </p>
          ) : null}

          <section>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase"><History size={13} /> History</h4>
            <ol className="relative space-y-3 border-l border-[var(--color-border)] pl-4" data-testid="visit-history">
              {(history.data ?? []).map((entry) => (
                <li key={entry.id} className="text-[12.5px]">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-[var(--color-primary)]" />
                  <p className="font-semibold text-[var(--color-ink)]">
                    {ACTION_LABEL[entry.action] ?? entry.action} · {entry.by?.fullName ?? 'System'}
                    <span className="ml-1.5 font-normal text-[var(--color-muted)]">{new Date(entry.at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </p>
                  {changeText(entry) ? <p className="text-[var(--color-muted)]">{changeText(entry)}</p> : null}
                  {entry.reason ? <p className="text-[var(--color-ink)]/80">Reason: {entry.reason}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </Modal>
  );
}
