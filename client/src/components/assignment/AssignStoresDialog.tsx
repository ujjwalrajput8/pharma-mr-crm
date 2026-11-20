import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserRoundCog } from 'lucide-react';
import { getApiErrorDetails, getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import type { AssignmentMove } from '@/services/doctors.service';
import { storesApi, type MedicalStore, type StoreMove } from '@/services/stores.service';
import { MoveConfirmDialog } from './MoveConfirmDialog';
import { MrPicker } from './MrPicker';

/** Chemists / stockists the server says would change MR, shaped for MoveConfirmDialog. */
function storeMovesFromError(error: unknown): AssignmentMove[] | null {
  const details = getApiErrorDetails<{ code?: string; moves?: StoreMove[] }>(error);
  if (details?.code !== 'CONFIRM_MOVE' || !details.moves?.length) return null;
  return details.moves.map((m) => ({
    doctorId: m.storeId,
    doctorName: m.storeName,
    from: m.from,
    to: m.to,
    pendingAppointments: 0,
    planCalls: m.planCalls,
    visits: 0,
  }));
}

/** "chemist", "stockist" or — for a mix — "store". */
function nounFor(stores: MedicalStore[]): string {
  const types = new Set(stores.map((s) => s.type));
  if (types.size !== 1) return 'store';
  return types.has('STOCKIST') ? 'stockist' : 'chemist';
}

/**
 * Put chemists / stockists in one MR's MSL list (or take them off). One that already
 * has another MR needs a confirmation first — the server asks (409), like doctors.
 */
export function AssignStoresDialog({
  stores,
  onClose,
  onDone,
}: {
  stores: MedicalStore[] | null;
  onClose: () => void;
  onDone: () => void;
}) {
  if (!stores?.length) return null;
  return <AssignForm stores={stores} onClose={onClose} onDone={onDone} />;
}

function AssignForm({ stores, onClose, onDone }: { stores: MedicalStore[]; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const noun = nounFor(stores);
  const one = stores.length === 1 ? stores[0]! : null;
  const [mrId, setMrId] = useState<number | null | undefined>(one ? (one.assignedMr?.id ?? null) : undefined);
  const [moves, setMoves] = useState<AssignmentMove[] | null>(null);
  const assign = useMutation({
    mutationFn: (opts: { confirmMove?: boolean; note?: string }) =>
      storesApi.assignMr(
        stores.map((s) => s.id),
        mrId ?? null,
        opts,
      ),
    onSuccess: async (result) => {
      setMoves(null);
      const what = `${result.stores} ${noun}${result.stores === 1 ? '' : 's'}`;
      toast.success(result.mr ? `${what} given to ${result.mr.fullName}` : `${what} taken off their MR`);
      await Promise.all(['stores', 'my-stores', 'mr-options'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onDone();
    },
    onError: (error) => setMoves(storeMovesFromError(error)),
  });
  const unchanged = one != null && (one.assignedMr?.id ?? null) === (mrId ?? null);
  return (
    <>
      <Modal
        open
        title={one ? `Assign ${one.name}` : `Assign ${stores.length} ${noun}s`}
        description={`Choose the MR whose MSL list gets the ${noun}. If it is with another MR you will be asked to confirm the move.`}
        icon={UserRoundCog}
        onClose={onClose}
        className="max-w-2xl"
        error={assign.isError && !moves ? getApiErrorMessage(assign.error) : null}
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={assign.isPending}>
              Cancel
            </Button>
            <Button onClick={() => assign.mutate({})} disabled={mrId === undefined || unchanged} loading={assign.isPending && !moves}>
              {mrId === null ? 'Unassign' : 'Assign'}
            </Button>
          </>
        }
      >
        <MrPicker
          label="Assign to"
          variant="inline"
          value={mrId ?? null}
          current={one ? (one.assignedMr ?? null) : undefined}
          onChange={(id) => setMrId(id)}
          allowUnassign
          required
        />
      </Modal>
      <MoveConfirmDialog
        moves={moves}
        noun={noun}
        loading={assign.isPending}
        onCancel={() => setMoves(null)}
        onConfirm={(note) => assign.mutate({ confirmMove: true, note })}
      />
    </>
  );
}
