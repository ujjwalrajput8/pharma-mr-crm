import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserRoundCog } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { doctorsApi, type AssignmentMove } from '@/services/doctors.service';
import { MoveConfirmDialog } from './MoveConfirmDialog';
import { movesFromError } from './moves';
import { MrPicker } from './MrPicker';

/**
 * Give the selected doctors to one MR (or take them off their MR). Doctors that
 * already have a different MR need a confirmation first — the server asks (409).
 */
export function AssignDoctorsDialog({
  doctorIds,
  onClose,
  onDone,
}: {
  doctorIds: number[] | null;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!doctorIds) return null;
  return <AssignForm doctorIds={doctorIds} onClose={onClose} onDone={onDone} />;
}

function AssignForm({ doctorIds, onClose, onDone }: { doctorIds: number[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [mrId, setMrId] = useState<number | null | undefined>(undefined);
  const [moves, setMoves] = useState<AssignmentMove[] | null>(null);
  const assign = useMutation({
    mutationFn: (opts: { confirmMove?: boolean; note?: string }) => doctorsApi.assignMr(doctorIds, mrId ?? null, opts),
    onSuccess: async (result) => {
      setMoves(null);
      toast.success(
        result.mr
          ? `${result.doctors} doctor${result.doctors === 1 ? '' : 's'} assigned to ${result.mr.fullName}`
          : `${result.doctors} doctor${result.doctors === 1 ? '' : 's'} unassigned`,
      );
      await Promise.all(['doctors', 'mr-options', 'doctor-details'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onDone();
    },
    onError: (error) => setMoves(movesFromError(error)),
  });
  return (
    <>
      <Modal
        open
        title={`Assign ${doctorIds.length} doctor${doctorIds.length === 1 ? '' : 's'}`}
        description="Choose the MR. If a doctor already has another MR you will be asked to confirm the move."
        icon={UserRoundCog}
        onClose={onClose}
        className="max-w-lg"
        error={assign.isError && !moves ? getApiErrorMessage(assign.error) : null}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={assign.isPending}>Cancel</Button>
            <Button onClick={() => assign.mutate({})} disabled={mrId === undefined} loading={assign.isPending && !moves}>
              {mrId === null ? 'Unassign' : 'Assign'}
            </Button>
          </>
        }
      >
        <MrPicker value={mrId ?? null} onChange={(id) => setMrId(id)} allowUnassign required />
      </Modal>
      <MoveConfirmDialog moves={moves} loading={assign.isPending} onCancel={() => setMoves(null)} onConfirm={(note) => assign.mutate({ confirmMove: true, note })} />
    </>
  );
}
