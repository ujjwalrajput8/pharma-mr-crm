import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { distributionsApi } from '@/services/distributions.service';

export function DistributionsPage() {
  const distributionsQuery = useQuery({
    queryKey: ['distributions'],
    queryFn: () => distributionsApi.list(),
  });

  const table = useClientTable({
    data: distributionsQuery.data ?? [],
    searchKeys: ['visitDate', 'medicineName', 'quantity', 'batchNumber', 'doctorName', 'mrName'],
    initialSortKey: 'visitDate',
    initialSortDir: 'desc',
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

      <Card className="p-4">
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search distributions…"
        />
        <DataTable
          columns={[
            { key: 'visitDate', label: 'Date', sortable: true },
            { key: 'medicineName', label: 'Medicine', sortable: true },
            { key: 'quantity', label: 'Qty', sortable: true },
            { key: 'batchNumber', label: 'Batch', sortable: true },
            { key: 'doctorName', label: 'Doctor', sortable: true },
            { key: 'mrName', label: 'MR', sortable: true },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={distributionsQuery.isLoading}
          empty={
            !distributionsQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={
                  table.totalAll === 0 ? 'No samples distributed yet' : 'No matching distributions'
                }
                description={
                  table.totalAll === 0
                    ? 'Complete a visit with sample quantities to populate this ledger.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((row) => (
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
        <TablePagination
          page={table.page}
          totalPages={table.totalPages}
          from={table.from}
          to={table.to}
          total={table.filteredTotal}
          pageSize={table.pageSize}
          pageSizeOptions={table.pageSizeOptions}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </Card>
    </div>
  );
}
