import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ListChecks } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Badge } from '@/components/ui/Page';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Textarea } from '@/components/ui/Field';
import { ChoiceChips, FormFull, FormGrid } from '@/components/ui/FormKit';
import { FormSection, Modal } from '@/components/ui/Modal';
import { TimePicker } from '@/components/ui/TimePicker';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { VISIT_PURPOSES, visitsApi, type BulkVisitResult, type BulkVisitRow, type VisitPurpose } from '@/services/visits.service';
import { toIsoDate } from '@/utils/datetime';

const STATUS: Record<BulkVisitRow['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'primary' | 'neutral' }> = {
  READY: { label: 'Ready', tone: 'primary' },
  CREATED: { label: 'Created', tone: 'success' },
  ALREADY_VISITED: { label: 'Already visited', tone: 'neutral' },
  UNLISTED: { label: 'Unlisted — log it on its own', tone: 'warning' },
  INVALID: { label: 'Invalid', tone: 'danger' },
  FAILED: { label: 'Failed', tone: 'danger' },
};

/**
 * Bulk = one entry for many doctors. Each doctor gets its own DIRECT visit through
 * the same rules; the result is per doctor (some can fail without undoing others).
 */
export function BulkVisitDialog({
  doctorIds,
  mrId,
  onClose,
}: {
  doctorIds: number[] | null;
  mrId?: number;
  onClose: () => void;
}) {
  if (!doctorIds) return null;
  return <BulkForm doctorIds={doctorIds} mrId={mrId} onClose={onClose} />;
}

function BulkForm({ doctorIds, mrId, onClose }: { doctorIds: number[]; mrId?: number; onClose: () => void }) {
  const { role } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const today = toIsoDate(new Date());
  const min = new Date(Date.parse(`${today}T00:00:00Z`) - (role === 'MR' ? 2 : 30) * 86_400_000).toISOString().slice(0, 10);
  const [form, setForm] = useState({ visitDate: today, visitTime: '10:00', purpose: 'DETAILING' as VisitPurpose | '', discussionNotes: '' });
  const [result, setResult] = useState<BulkVisitResult | null>(null);

  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      visitsApi.bulk({
        doctorIds,
        ...(mrId ? { mrId } : {}),
        visitDate: form.visitDate,
        visitTime: form.visitTime,
        purpose: form.purpose || undefined,
        discussionNotes: form.discussionNotes || undefined,
        dryRun,
      }),
    onSuccess: async (data) => {
      setResult(data);
      if (!data.dryRun) {
        await Promise.all(['visits', 'appointments', 'my-day', 'dashboard'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
        toast.success(`${data.summary.created} visit${data.summary.created === 1 ? '' : 's'} logged`, `${data.summary.skipped} skipped · ${data.summary.failed} failed`);
      }
    },
  });
  const saved = result && !result.dryRun;

  return (
    <Modal
      open
      title={`Log visits for ${doctorIds.length} doctor${doctorIds.length === 1 ? '' : 's'}`}
      description="One entry, a separate visit for each doctor. Samples are logged visit by visit, not here."
      icon={ListChecks}
      onClose={onClose}
      className="max-w-2xl"
      error={run.isError ? getApiErrorMessage(run.error) : null}
      footer={
        saved ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={run.isPending}>
              Cancel
            </Button>
            {result?.dryRun ? (
              <Button onClick={() => run.mutate(false)} loading={run.isPending} disabled={result.summary.ready === 0}>
                Save {result.summary.ready} visit{result.summary.ready === 1 ? '' : 's'}
              </Button>
            ) : (
              <Button onClick={() => run.mutate(true)} loading={run.isPending}>
                Preview
              </Button>
            )}
          </>
        )
      }
    >
      <div className="space-y-5">
        <FormSection title="Common for all" icon={ListChecks}>
          <FormGrid>
            <DatePicker label="Visit date" required min={min} max={today} value={form.visitDate} onChange={(v) => { setResult(null); setForm((f) => ({ ...f, visitDate: v })); }} disabled={Boolean(saved)} />
            <TimePicker label="Time" required value={form.visitTime} onChange={(v) => { setResult(null); setForm((f) => ({ ...f, visitTime: v })); }} disabled={Boolean(saved)} />
            <FormFull>
              <ChoiceChips label="Purpose" options={VISIT_PURPOSES.filter((p) => p.value !== 'OTHER')} value={form.purpose} onChange={(v) => setForm((f) => ({ ...f, purpose: v as VisitPurpose | '' }))} />
            </FormFull>
            <FormFull>
              <Textarea label="Notes" optional maxLength={5000} rows={2} value={form.discussionNotes} onChange={(e) => setForm((f) => ({ ...f, discussionNotes: e.target.value }))} placeholder="Same note on every visit" />
            </FormFull>
          </FormGrid>
        </FormSection>

        {result ? (
          <div data-testid={saved ? 'bulk-result' : 'bulk-preview'}>
            <p className="mb-2 text-[12.5px] font-semibold text-[var(--color-ink)]" data-testid="bulk-summary">
              {saved
                ? `${result.summary.created} created · ${result.summary.skipped} skipped · ${result.summary.failed} failed`
                : `${result.summary.ready} ready · ${result.summary.skipped} will be skipped`}
            </p>
            <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)]">
              {result.rows.map((row) => (
                <li key={row.doctorId} data-status={row.status} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-[var(--color-ink)]">{row.doctorName ?? `Doctor ${row.doctorId}`}</span>
                    <span className="block text-[11px] text-[var(--color-muted)]">
                      {[row.mslNo ? `MSL ${row.mslNo}` : null, row.area, row.reason].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <Badge tone={STATUS[row.status].tone}>{STATUS[row.status].label}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-[12px] text-[var(--color-muted)]">Preview first — doctors already visited that day, not in the list, or inactive are shown and skipped.</p>
        )}
      </div>
    </Modal>
  );
}
