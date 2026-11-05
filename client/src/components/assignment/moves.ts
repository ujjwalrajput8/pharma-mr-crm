import { getApiErrorDetails } from '@/api/client';
import type { AssignmentMove } from '@/services/doctors.service';

/** The server's answer when a doctor would change MR: confirm first (D4 / D15). */
export function movesFromError(error: unknown): AssignmentMove[] | null {
  const details = getApiErrorDetails<{ code?: string; moves?: AssignmentMove[] }>(error);
  return details?.code === 'CONFIRM_MOVE' && details.moves?.length ? details.moves : null;
}
