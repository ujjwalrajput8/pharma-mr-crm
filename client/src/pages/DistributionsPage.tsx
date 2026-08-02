import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { DataTable, Td } from '@/components/ui/DataTable';
import { distributionsApi } from '@/services/distributions.service';

export function DistributionsPage() {
  const distributionsQuery = useQuery({
    queryKey: ['distributions'],
    queryFn: () => distributionsApi.list(),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Medicine Distribution"
        description="Sample ledger from completed visits. Stock decreases automatically on distribute."
      />

      <Card className="border-dashed p-4 text-sm text-[var(--color-muted)]">
        Samples are recorded when completing an appointment (Complete + Visit). This page is the
        read-only distribution history.
      </Card>

      <Card>
        <DataTable
          columns={['Date', 'Medicine', 'Qty', 'Batch', 'Doctor', 'MR']}
          loading={distributionsQuery.isLoading}
          empty={
            !distributionsQuery.isLoading && distributionsQuery.data?.length === 0 ? (
              <EmptyState
                title="No samples distributed yet"
                description="Complete a visit with sample quantities to populate this ledger."
              />
            ) : null
          }
        >
          {distributionsQuery.data?.map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{row.visitDate}</Td>
              <Td>{row.medicineName}</Td>
              <Td>{row.quantity}</Td>
              <Td>{row.batchNumber ?? '—'}</Td>
              <Td>{row.doctorName}</Td>
              <Td>{row.mrName}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
