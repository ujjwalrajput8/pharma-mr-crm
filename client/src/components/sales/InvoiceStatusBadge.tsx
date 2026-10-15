import { Stethoscope, Store } from 'lucide-react';
import { Badge } from '@/components/ui/Page';
import type { InvoiceParty, InvoiceStatus } from '@/services/invoices.service';

const STATUS_TONES: Record<InvoiceStatus, 'danger' | 'warning' | 'success' | 'neutral'> = {
  UNPAID: 'danger',
  PARTIAL: 'warning',
  PAID: 'success',
  CANCELLED: 'neutral',
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={STATUS_TONES[status] ?? 'neutral'}>{status}</Badge>;
}

/** Doctor (stethoscope) / chemist (store) icon + name. */
export function PartyLabel({ party }: { party: InvoiceParty | null }) {
  if (!party) return <span className="text-[var(--color-muted)]">—</span>;
  const Icon = party.type === 'DOCTOR' ? Stethoscope : Store;
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon size={14} className="shrink-0 text-[var(--color-muted)]" />
      <span className="font-medium">{party.name}</span>
    </span>
  );
}
