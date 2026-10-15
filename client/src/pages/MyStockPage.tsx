import { useQuery } from '@tanstack/react-query';
import { ArrowDownToLine, ArrowUpFromLine, CalendarClock, Package, Pill } from 'lucide-react';
import { useMemo } from 'react';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatTile } from '@/components/ui/Page';
import { useAuth } from '@/store/AuthContext';
import { stockApi } from '@/services/stock.service';
import type { LedgerHolderRef, LedgerTxn } from '@/services/ledger.service';

const HOLDER_LABEL: Record<string, string> = {
  WAREHOUSE: 'Warehouse',
  USER: 'MR',
  DOCTOR: 'Doctor',
  CHEMIST: 'Chemist',
};

function holderText(ref: LedgerHolderRef | null): string {
  if (!ref) return '—';
  return ref.name ?? `${HOLDER_LABEL[ref.type] ?? ref.type} #${ref.id}`;
}

function daysToExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(`${expiryDate}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return null;
  return Math.ceil((expiry.getTime() - Date.now()) / 86_400_000);
}

export function MyStockPage() {
  const { user } = useAuth();

  const myStockQuery = useQuery({
    queryKey: ['my-stock'],
    queryFn: () => stockApi.my(),
  });

  const holdings = myStockQuery.data?.holdings ?? [];
  const recent = myStockQuery.data?.recent ?? [];

  const totals = useMemo(() => {
    const units = holdings.reduce((sum, row) => sum + row.qty, 0);
    const products = new Set(holdings.map((row) => row.medicine.id)).size;
    const expiringSoon = holdings.filter((row) => {
      const days = daysToExpiry(row.batch.expiryDate);
      return days !== null && days < 60;
    }).length;
    return { units, products, expiringSoon };
  }, [holdings]);

  /** in = stock came to me, out = stock left my bag. */
  function direction(txn: LedgerTxn): 'in' | 'out' | null {
    if (txn.to?.type === 'USER' && txn.to.id === user?.id) return 'in';
    if (txn.from?.type === 'USER' && txn.from.id === user?.id) return 'out';
    return null;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My stock"
        description="Sample stock you are carrying, by product and batch, with your latest movements from the ledger."
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="Units in bag"
          value={totals.units.toLocaleString('en-IN')}
          icon={Package}
          tone="primary"
        />
        <StatTile label="Products" value={totals.products} icon={Pill} />
        <StatTile
          label="Expiring in 60 days"
          value={totals.expiringSoon}
          icon={CalendarClock}
          tone={totals.expiringSoon > 0 ? 'danger' : 'success'}
          hint={totals.expiringSoon > 0 ? 'Return or use these batches first' : 'No batch is close to expiry'}
        />
      </div>

      <Card>
        <CardHeader
          title="Holdings"
          description="Batch-wise on-hand quantity from your stock balance"
        />
        <DataTable
          columns={['Medicine', 'Batch', 'Expiry', 'Qty']}
          loading={myStockQuery.isLoading}
          empty={
            !myStockQuery.isLoading && holdings.length === 0 ? (
              <EmptyState
                title="Your bag is empty"
                description="Stock issued to you by a manager will appear here batch by batch."
              />
            ) : null
          }
        >
          {holdings.map((row) => {
            const days = daysToExpiry(row.batch.expiryDate);
            return (
              <tr
                key={`${row.medicine.id}-${row.batch.id}`}
                className="border-b border-[var(--color-border)] last:border-0"
              >
                <Td>
                  <span className="font-medium">{row.medicine.name}</span>
                  {row.medicine.company ? (
                    <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                      {row.medicine.company}
                    </span>
                  ) : null}
                </Td>
                <Td className="font-mono text-xs">{row.batch.batchNo}</Td>
                <Td>
                  {row.batch.expiryDate ? (
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs">{row.batch.expiryDate}</span>
                      {days !== null && days < 0 ? (
                        <Badge tone="danger">Expired</Badge>
                      ) : days !== null && days < 60 ? (
                        <Badge tone="danger">{days}d left</Badge>
                      ) : days !== null && days < 180 ? (
                        <Badge tone="warning">{days}d</Badge>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">—</span>
                  )}
                </Td>
                <Td>
                  <span className="font-semibold text-[var(--color-primary)]">{row.qty}</span>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Card>

      <Card>
        <CardHeader
          title="Recent movement"
          description="Your last 30 ledger transactions — issues to you, samples you gave, returns"
        />
        {myStockQuery.isLoading ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--color-muted)]">Loading…</p>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No movement yet"
            description="Once stock is issued to you or you give samples, each movement shows up here."
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {recent.map((txn) => {
              const dir = direction(txn);
              return (
                <li key={txn.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className={
                      dir === 'in'
                        ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-success-soft)] text-[var(--color-success)]'
                        : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
                    }
                  >
                    {dir === 'in' ? <ArrowDownToLine size={15} /> : <ArrowUpFromLine size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-ink)]">
                      {txn.medicine.name}
                      <span className="ml-2 text-xs font-normal text-[var(--color-muted)]">
                        Batch {txn.batch.batchNo}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                      {txn.txnType.replace(/_/g, ' ')} ·{' '}
                      {dir === 'in' ? `from ${holderText(txn.from)}` : `to ${holderText(txn.to)}`} ·{' '}
                      {txn.txnDate}
                    </p>
                  </div>
                  <span
                    className={
                      dir === 'in'
                        ? 'shrink-0 text-sm font-bold text-[var(--color-success)]'
                        : 'shrink-0 text-sm font-bold text-[var(--color-danger)]'
                    }
                  >
                    {dir === 'in' ? '+' : '−'}
                    {txn.qty}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
