import { useMemo, useState } from 'react';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Input, Select } from '@/components/ui/Field';
import { Badge, Card, PageHeader } from '@/components/ui/Page';
import { MOCK_LEDGER, type StockTxnType } from '@/mocks/fieldForce';

const txnTone: Record<StockTxnType, 'primary' | 'success' | 'warning' | 'danger' | 'neutral'> = {
  OPENING: 'neutral',
  TRANSFER: 'primary',
  ISSUE: 'primary',
  SAMPLE_GIVEN: 'success',
  SALE: 'success',
  RETURN: 'warning',
  ADJUSTMENT: 'danger',
  EXPIRY_WRITEOFF: 'danger',
};

export function LedgerPage() {
  const [txnType, setTxnType] = useState('ALL');
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    return MOCK_LEDGER.filter((row) => {
      if (txnType !== 'ALL' && row.txnType !== txnType) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        row.productName.toLowerCase().includes(q) ||
        row.batchNo.toLowerCase().includes(q) ||
        row.fromLabel.toLowerCase().includes(q) ||
        row.toLabel.toLowerCase().includes(q) ||
        row.ref.toLowerCase().includes(q)
      );
    });
  }, [txnType, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Ledger explorer"
        description="Append-only stock movements. Closing stock is derived — never edited in place."
      />

      <Card>
        <div className="grid gap-3 border-b border-[var(--color-border)] p-4 sm:grid-cols-2">
          <Input
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Product, batch, holder, ref…"
          />
          <Select label="Txn type" value={txnType} onChange={(e) => setTxnType(e.target.value)}>
            <option value="ALL">All types</option>
            <option value="TRANSFER">TRANSFER</option>
            <option value="ISSUE">ISSUE</option>
            <option value="SAMPLE_GIVEN">SAMPLE_GIVEN</option>
            <option value="SALE">SALE</option>
            <option value="RETURN">RETURN</option>
            <option value="ADJUSTMENT">ADJUSTMENT</option>
          </Select>
        </div>

        <DataTable
          columns={['Date', 'Type', 'Product', 'Batch', 'Qty', 'From', 'To', 'Ref']}
          empty={
            rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-[var(--color-muted)]">No rows</p>
            ) : null
          }
        >
          {rows.map((row) => (
            <tr
              key={row.id}
              className="transition-colors hover:bg-[var(--color-bg)]/80"
            >
              <Td className="font-medium">{row.txnDate}</Td>
              <Td>
                <Badge tone={txnTone[row.txnType]}>{row.txnType}</Badge>
              </Td>
              <Td>{row.productName}</Td>
              <Td className="font-mono text-xs">{row.batchNo}</Td>
              <Td className={row.qty < 0 ? 'font-semibold text-[var(--color-danger)]' : 'font-semibold'}>
                {row.qty}
              </Td>
              <Td className="text-[var(--color-muted)]">{row.fromLabel}</Td>
              <Td>{row.toLabel}</Td>
              <Td className="font-mono text-xs text-[var(--color-muted)]">{row.ref}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
