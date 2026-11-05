import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Package, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { QtyStepper } from '@/components/ui/FormKit';
import { stockApi, type MyStockHolding } from '@/services/stock.service';
import type { VisitSampleInput } from '@/services/visits.service';

export interface SampleLine extends VisitSampleInput {
  key: string;
}

const SOON_DAYS = 60;

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.now()) / 86_400_000);
}

/**
 * Samples from the MR's own bag — never the warehouse. Each line: medicine, batch
 * (earliest expiry by default), quantity up to what is in the bag, and what is left
 * after. The server checks the same thing again when saving.
 */
export function SamplePicker({
  mrId,
  self,
  lines,
  onChange,
}: {
  mrId: number | null;
  /** True when the visit is the signed-in user's own (their bag: /stock/my). */
  self: boolean;
  lines: SampleLine[];
  onChange: (lines: SampleLine[]) => void;
}) {
  const bag = useQuery({
    queryKey: ['bag', self ? 'me' : mrId],
    queryFn: () => (self ? stockApi.my() : stockApi.holdings(mrId!)),
    enabled: self || mrId != null,
  });
  const today = new Date().toISOString().slice(0, 10);
  const holdings = useMemo(
    () => (bag.data?.holdings ?? []).filter((h) => !h.batch.expiryDate || h.batch.expiryDate >= today),
    [bag.data, today],
  );
  const medicines = useMemo(() => {
    const map = new Map<number, { id: number; name: string; total: number; batches: MyStockHolding[] }>();
    for (const h of holdings) {
      const row = map.get(h.medicine.id) ?? { id: h.medicine.id, name: h.medicine.name, total: 0, batches: [] };
      row.total += h.qty;
      row.batches.push(h);
      map.set(h.medicine.id, row);
    }
    for (const row of map.values()) row.batches.sort((a, b) => (a.batch.expiryDate ?? '9999').localeCompare(b.batch.expiryDate ?? '9999'));
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [holdings]);

  const usedElsewhere = (key: string, medicineId: number) =>
    lines.filter((l) => l.key !== key && l.medicineId === medicineId).reduce((sum, l) => sum + l.quantity, 0);
  const update = (key: string, patch: Partial<SampleLine>) =>
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  if (bag.isLoading) return <p className="text-xs text-[var(--color-muted)]">Loading the bag…</p>;
  if (medicines.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] px-4 py-3 text-[12.5px] text-[var(--color-muted)]" data-testid="bag-empty">
        <Package size={16} />
        <span>
          The bag is empty — no samples can be given.{' '}
          {self ? (
            <Link to="/my-stock" className="font-semibold text-[var(--color-primary)] hover:underline">
              My Stock
            </Link>
          ) : null}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" data-testid="sample-picker">
      {lines.map((line) => {
        const med = medicines.find((m) => m.id === line.medicineId);
        const pinned = med?.batches.find((b) => b.batch.id === line.batchId);
        const available = pinned ? pinned.qty : (med?.total ?? 0);
        const max = Math.max(0, available - usedElsewhere(line.key, line.medicineId));
        const firstExpiry = (pinned ?? med?.batches[0])?.batch.expiryDate ?? null;
        const soon = (daysUntil(firstExpiry) ?? 999) <= SOON_DAYS;
        return (
          <div key={line.key} className="rounded-xl border border-[var(--color-border)] p-3" data-testid="sample-line">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-[180px] flex-1">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--color-ink)]/75">Medicine</span>
                <select
                  aria-label="Sample medicine"
                  value={line.medicineId}
                  onChange={(e) => update(line.key, { medicineId: Number(e.target.value), batchId: undefined, quantity: 1 })}
                  className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/70 px-3 text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)]/70"
                >
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.total} in bag
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[150px]">
                <span className="mb-1 block text-[11px] font-semibold text-[var(--color-ink)]/75">Batch</span>
                <select
                  aria-label="Sample batch"
                  value={line.batchId ?? ''}
                  onChange={(e) => update(line.key, { batchId: e.target.value ? Number(e.target.value) : undefined })}
                  className="h-9 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/70 px-3 text-[13px] text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)]/70"
                >
                  <option value="">Earliest expiry first</option>
                  {med?.batches.map((b) => (
                    <option key={b.batch.id} value={b.batch.id}>
                      {b.batch.batchNo} · exp {b.batch.expiryDate ?? '—'} · {b.qty}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <span className="mb-1 block text-[11px] font-semibold text-[var(--color-ink)]/75">Qty</span>
                <QtyStepper label="sample quantity" value={line.quantity} min={1} max={Math.max(1, max)} onChange={(q) => update(line.key, { quantity: q })} />
              </div>
              <Button variant="ghost" size="icon-sm" aria-label="Remove sample" onClick={() => onChange(lines.filter((l) => l.key !== line.key))}>
                <Trash2 size={14} />
              </Button>
            </div>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-muted)]">
              <span data-testid="bag-after">
                Bag after: <span className="font-semibold text-[var(--color-ink)] tabular-nums">{Math.max(0, available - usedElsewhere(line.key, line.medicineId) - line.quantity)}</span>
              </span>
              {firstExpiry ? <span>Expiry {firstExpiry}</span> : null}
              {soon ? (
                <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-warning)]">
                  <AlertTriangle size={11} /> Expires within {SOON_DAYS} days
                </span>
              ) : null}
              {line.quantity > max ? <span className="font-semibold text-[var(--color-danger)]">More than the bag has</span> : null}
            </p>
          </div>
        );
      })}
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          const next = medicines.find((m) => m.total - usedElsewhere('', m.id) > 0) ?? medicines[0]!;
          onChange([...lines, { key: crypto.randomUUID(), medicineId: next.id, quantity: 1 }]);
        }}
      >
        <Plus size={13} /> Add sample
      </Button>
    </div>
  );
}
