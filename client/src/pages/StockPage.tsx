import { useQuery } from '@tanstack/react-query';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { DataTable, Td } from '@/components/ui/DataTable';
import { medicinesApi } from '@/services/medicines.service';

export function StockPage() {
  const medicinesQuery = useQuery({
    queryKey: ['medicines', 'stock'],
    queryFn: () => medicinesApi.list(),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Management"
        description="Opening, issued, returned, available stock with minimum alerts."
      />

      <Card>
        <DataTable
          columns={['Medicine', 'Opening', 'Issued', 'Returned', 'Available', 'Min Alert']}
          loading={medicinesQuery.isLoading}
          empty={
            !medicinesQuery.isLoading && medicinesQuery.data?.length === 0 ? (
              <EmptyState
                title="No stock records"
                description="Add medicines first to see inventory here."
              />
            ) : null
          }
        >
          {medicinesQuery.data?.map((medicine) => (
            <tr key={medicine.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{medicine.name}</Td>
              <Td>{medicine.stock?.openingStock ?? 0}</Td>
              <Td>{medicine.stock?.issued ?? 0}</Td>
              <Td>{medicine.stock?.returned ?? 0}</Td>
              <Td>
                <span
                  className={
                    medicine.stock?.isLow
                      ? 'font-semibold text-[var(--color-danger)]'
                      : 'font-semibold text-[var(--color-primary)]'
                  }
                >
                  {medicine.stock?.available ?? 0}
                </span>
                {medicine.stock?.isLow ? (
                  <Badge tone="danger">Low</Badge>
                ) : null}
              </Td>
              <Td>{medicine.stock?.minimumStockAlert ?? 0}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
