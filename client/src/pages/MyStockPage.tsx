import { DataTable, Td } from '@/components/ui/DataTable';
import { Badge, Card, PageHeader, StatTile } from '@/components/ui/Page';
import { daysUntilExpiry, MOCK_MY_STOCK } from '@/mocks/fieldForce';

export function MyStockPage() {
  const totalQty = MOCK_MY_STOCK.reduce((sum, row) => sum + row.qty, 0);
  const nearExpiry = MOCK_MY_STOCK.filter((row) => daysUntilExpiry(row.expiryDate) <= 90).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="My stock"
        description="Carrying stock by product and batch. Balance is ledger-derived."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Units on hand" value={totalQty} />
        <StatTile label="Near expiry (≤90d)" value={nearExpiry} />
      </div>

      <Card>
        <DataTable columns={['Product', 'Batch', 'Expiry', 'On hand', 'Risk']}>
          {MOCK_MY_STOCK.map((row) => {
            const days = daysUntilExpiry(row.expiryDate);
            const risky = days <= 90;
            return (
              <tr
                key={`${row.productName}-${row.batchNo}`}
                className="transition-colors hover:bg-[var(--color-bg)]/80"
              >
                <Td className="font-medium">{row.productName}</Td>
                <Td className="font-mono text-xs">{row.batchNo}</Td>
                <Td>{row.expiryDate}</Td>
                <Td className="font-semibold">{row.qty}</Td>
                <Td>
                  {risky ? <Badge tone="warning">{days}d</Badge> : <Badge tone="success">OK</Badge>}
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
    </div>
  );
}
