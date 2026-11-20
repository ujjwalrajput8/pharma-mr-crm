import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { api, getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert, Card, EmptyState } from '@/components/ui/Page';
import type { ApiSuccess } from '@/types';
import { downloadCsv } from '@/utils/exportReport';

interface PartyRow {
  party: string;
  type: string;
  area: string | null;
  bills: number;
  quantity: number;
  amount: number;
}
interface ProductRow {
  product: string;
  parties: number;
  quantity: number;
  amount: number;
}
interface Breakdown<T> {
  by: 'party' | 'product';
  range: { from: string; to: string };
  rows: T[];
  totals: { amount: number; quantity: number; parties?: number; products?: number };
}

const money = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

/**
 * Party-wise / product-wise sales (client note → View → Sales): totals from invoices and
 * Quick POB bill lines. MR: own; Manager: team; Admin: all. Default: this month.
 */
export function SalesBreakdownTab({ by }: { by: 'party' | 'product' }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = useQuery({
    queryKey: ['sales', 'breakdown', by, from, to],
    queryFn: async () => {
      const { data } = await api.get<ApiSuccess<Breakdown<PartyRow | ProductRow>>>('/sales/breakdown', {
        params: { by, ...(from ? { from } : {}), ...(to ? { to } : {}) },
      });
      return data.data;
    },
  });
  const d = query.data;
  const partyRows = by === 'party' ? ((d?.rows ?? []) as PartyRow[]) : [];
  const productRows = by === 'product' ? ((d?.rows ?? []) as ProductRow[]) : [];

  return (
    <Card className="space-y-4 p-4" data-testid={`sales-${by}-wise`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-3 sm:max-w-md sm:grid-cols-2">
          <DatePicker label="From" value={from} onChange={setFrom} max={to || undefined} placeholder="Start of month" />
          <DatePicker label="To" value={to} onChange={setTo} min={from || undefined} placeholder="Today" />
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={!d?.rows.length}
          onClick={() =>
            d &&
            downloadCsv(`sales-${by}-wise-${d.range.from}-${d.range.to}`, d.rows as unknown as Array<Record<string, string | number | null>>, {
              from: d.range.from,
              to: d.range.to,
              amount: d.totals.amount,
              quantity: d.totals.quantity,
            })
          }
        >
          <Download size={14} /> CSV
        </Button>
      </div>
      {query.isError ? <Alert message={getApiErrorMessage(query.error)} /> : null}
      {d ? (
        <p className="text-xs text-[var(--color-muted)]">
          {d.range.from} → {d.range.to} · {by === 'party' ? `${d.totals.parties} parties` : `${d.totals.products} products`} · {d.totals.quantity} units ·{' '}
          <span className="font-semibold text-[var(--color-ink)]">{money(d.totals.amount)}</span>
        </p>
      ) : null}
      {d && d.rows.length === 0 ? <EmptyState title="No sales in this period" description="Invoices and Quick POB entries appear here." /> : null}
      {d && d.rows.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[13px]">
            <thead className="border-b border-[var(--color-border)] text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
              {by === 'party' ? (
                <tr>
                  <th className="px-2 py-2 text-left">Party</th>
                  <th className="px-2 py-2 text-left">Type</th>
                  <th className="px-2 py-2 text-right">Bills</th>
                  <th className="px-2 py-2 text-right">Units</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-right">Parties</th>
                  <th className="px-2 py-2 text-right">Units</th>
                  <th className="px-2 py-2 text-right">Amount</th>
                </tr>
              )}
            </thead>
            <tbody>
              {partyRows.map((r) => (
                <tr key={`${r.type}-${r.party}`} className="border-b border-[var(--color-border)] last:border-0 tabular-nums" data-testid="breakdown-row">
                  <td className="px-2 py-2 font-medium text-[var(--color-ink)]">
                    {r.party}
                    {r.area ? <span className="block text-[11px] font-normal text-[var(--color-muted)]">{r.area}</span> : null}
                  </td>
                  <td className="px-2 py-2">{r.type}</td>
                  <td className="px-2 py-2 text-right">{r.bills}</td>
                  <td className="px-2 py-2 text-right">{r.quantity}</td>
                  <td className="px-2 py-2 text-right font-semibold">{money(r.amount)}</td>
                </tr>
              ))}
              {productRows.map((r) => (
                <tr key={r.product} className="border-b border-[var(--color-border)] last:border-0 tabular-nums" data-testid="breakdown-row">
                  <td className="px-2 py-2 font-medium text-[var(--color-ink)]">{r.product}</td>
                  <td className="px-2 py-2 text-right">{r.parties}</td>
                  <td className="px-2 py-2 text-right">{r.quantity}</td>
                  <td className="px-2 py-2 text-right font-semibold">{money(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
