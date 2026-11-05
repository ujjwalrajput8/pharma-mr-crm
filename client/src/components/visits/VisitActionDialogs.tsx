import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PackageMinus, ShieldCheck } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { MoveConfirmDialog } from '@/components/assignment/MoveConfirmDialog';
import { movesFromError } from '@/components/assignment/moves';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { ChoiceChips, QtyStepper } from '@/components/ui/FormKit';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { AssignmentMove } from '@/services/doctors.service';
import { visitsApi, type SampleCorrectionLine, type Visit } from '@/services/visits.service';

const refreshKeys = ['visits', 'my-day', 'my-stock', 'bag', 'distributions', 'doctors', 'doctor-details'];

/** Manager / Admin: put samples back in the bag, write them off, or add what was really given. */
export function SampleCorrectionDialog({ visit, onClose }: { visit: Visit | null; onClose: () => void }) {
  if (!visit) return null;
  return <SampleCorrectionForm visit={visit} onClose={onClose} />;
}

function SampleCorrectionForm({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [lines, setLines] = useState(
    visit.distributions.map((s) => ({ ...s, action: 'RETURN_TO_BAG' as SampleCorrectionLine['action'], qty: 0 })),
  );
  const [reason, setReason] = useState('');
  const chosen = lines.filter((l) => l.qty > 0);
  const save = useMutation({
    mutationFn: () =>
      visitsApi.correctSamples(visit.id, {
        reason: reason.trim(),
        lines: chosen.map((l) => ({ action: l.action, medicineId: l.medicineId, batchId: l.batchId, quantity: l.qty })),
      }),
    onSuccess: async () => {
      await Promise.all(refreshKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success('Samples corrected', 'A new ledger entry was added — the original stays as it was.');
      onClose();
    },
  });
  return (
    <Modal
      open
      title="Sample correction"
      description={`${visit.doctor?.fullName ?? 'Visit'} · ${visit.visitDate}. Every change is a new stock-ledger entry.`}
      icon={PackageMinus}
      onClose={onClose}
      className="max-w-2xl"
      error={save.isError ? getApiErrorMessage(save.error) : null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={chosen.length === 0 || reason.trim().length < 5}>
            Save correction
          </Button>
        </>
      }
    >
      <div className="space-y-4" data-testid="sample-correction">
        {lines.map((line, index) => (
          <div key={`${line.medicineId}-${line.batchId}`} className="rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-[13px] font-semibold text-[var(--color-ink)]">
              {line.medicineName} <span className="ml-1 text-[11px] font-normal text-[var(--color-muted)]">batch {line.batchNumber} · given now {line.quantity}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <ChoiceChips
                size="sm"
                options={[
                  { value: 'RETURN_TO_BAG', label: 'Back to MR bag' },
                  { value: 'WRITE_OFF', label: 'Write off' },
                  { value: 'ADD_GIVEN', label: 'Gave more' },
                ]}
                value={line.action}
                onChange={(v) => setLines((ls) => ls.map((l, i) => (i === index ? { ...l, action: v as SampleCorrectionLine['action'] } : l)))}
              />
              <QtyStepper
                label="correction quantity"
                value={line.qty}
                min={0}
                max={line.action === 'ADD_GIVEN' ? undefined : line.quantity}
                onChange={(q) => setLines((ls) => ls.map((l, i) => (i === index ? { ...l, qty: q } : l)))}
              />
            </div>
          </div>
        ))}
        <Input label="Reason" required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Two strips came back unopened" hint="Kept with the ledger entry and in the visit history." />
      </div>
    </Modal>
  );
}

/** Unlisted visit: assign the doctor to the MR (confirm if it means a move) or just mark reviewed. */
export function ReviewVisitDialog({ visit, onClose }: { visit: Visit | null; onClose: () => void }) {
  if (!visit) return null;
  return <ReviewForm visit={visit} onClose={onClose} />;
}

function ReviewForm({ visit, onClose }: { visit: Visit; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'ASSIGN' | 'REVIEWED'>('ASSIGN');
  const [note, setNote] = useState('');
  const [moves, setMoves] = useState<AssignmentMove[] | null>(null);
  const save = useMutation({
    mutationFn: (opts: { confirmMove?: boolean; note?: string }) =>
      visitsApi.review(visit.id, { action, note: (opts.note ?? note).trim() || undefined, confirmMove: opts.confirmMove }),
    onSuccess: async () => {
      setMoves(null);
      await Promise.all(refreshKeys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success(action === 'ASSIGN' ? `${visit.doctor?.fullName ?? 'Doctor'} assigned to ${visit.mr?.fullName ?? 'the MR'}` : 'Marked reviewed');
      onClose();
    },
    onError: (error) => setMoves(movesFromError(error)),
  });
  return (
    <>
      <Modal
        open
        title="Review unlisted visit"
        description={`${visit.mr?.fullName ?? 'MR'} met ${visit.doctor?.fullName ?? 'a doctor'} who is not in their list. The visit itself does not change.`}
        icon={ShieldCheck}
        onClose={onClose}
        className="max-w-lg"
        error={save.isError && !moves ? getApiErrorMessage(save.error) : null}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={save.isPending}>Cancel</Button>
            <Button onClick={() => save.mutate({})} loading={save.isPending && !moves}>
              {action === 'ASSIGN' ? 'Assign doctor' : 'Mark reviewed'}
            </Button>
          </>
        }
      >
        <div className="space-y-4" data-testid="review-visit">
          <ChoiceChips
            label="Decision"
            options={[
              { value: 'ASSIGN', label: `Assign doctor to ${visit.mr?.fullName ?? 'this MR'}` },
              { value: 'REVIEWED', label: 'Mark reviewed (keep as is)' },
            ]}
            value={action}
            onChange={(v) => setAction((v || 'ASSIGN') as 'ASSIGN' | 'REVIEWED')}
          />
          <Textarea label="Note" optional maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Doctor moved to this area" />
        </div>
      </Modal>
      <MoveConfirmDialog moves={moves} loading={save.isPending} onCancel={() => setMoves(null)} onConfirm={(n) => save.mutate({ confirmMove: true, note: n || note })} />
    </>
  );
}
