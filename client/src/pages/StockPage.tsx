import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Input, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { stockApi, type StockItem } from '@/services/stock.service';

export function StockPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [lowOnly, setLowOnly] = useState(false);
  const [adjustFor, setAdjustFor] = useState<StockItem | null>(null);
  const [quantityDelta, setQuantityDelta] = useState('0');
  const [remarks, setRemarks] = useState('');

  const stockQuery = useQuery({
    queryKey: ['stock', { lowOnly }],
    queryFn: () => stockApi.list({ lowOnly: lowOnly || undefined }),
  });

  const table = useClientTable({
    data: stockQuery.data ?? [],
    searchKeys: [
      'medicineName',
      'company',
      'openingStock',
      'issued',
      'returned',
      'available',
      'minimumStockAlert',
    ],
    initialSortKey: 'medicineName',
  });

  const adjustMutation = useMutation({
    mutationFn: stockApi.adjust,
    onSuccess: async () => {
      setAdjustFor(null);
      setQuantityDelta('0');
      setRemarks('');
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function onAdjustSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!adjustFor) return;
    const delta = Number(quantityDelta);
    if (!Number.isInteger(delta) || delta === 0) {
      setError('Enter a non-zero whole number for the adjustment');
      return;
    }
    adjustMutation.mutate({
      medicineId: adjustFor.medicineId,
      quantityDelta: delta,
      remarks: remarks.trim() || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock Management"
        description="Opening, issued, returned, available stock with minimum alerts. Sample issues reduce available automatically on visit completion."
        actions={
          <Button
            variant={lowOnly ? 'primary' : 'secondary'}
            onClick={() => setLowOnly((value) => !value)}
          >
            {lowOnly ? 'Showing low stock' : 'Low stock only'}
          </Button>
        }
      />

      {error ? <Alert message={error} /> : null}

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search stock…"
        />
        <DataTable
          columns={[
            { key: 'medicineName', label: 'Medicine', sortable: true },
            { key: 'openingStock', label: 'Opening', sortable: true },
            { key: 'issued', label: 'Issued', sortable: true },
            { key: 'returned', label: 'Returned', sortable: true },
            { key: 'available', label: 'Available', sortable: true },
            { key: 'minimumStockAlert', label: 'Min Alert', sortable: true },
            { key: 'actions', label: 'Actions' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={stockQuery.isLoading}
          empty={
            !stockQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No stock records' : 'No matching stock'}
                description={
                  table.totalAll === 0
                    ? 'Add medicines first to see inventory here.'
                    : 'Try a different search term or toggle low stock filter.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">
                {row.medicineName}
                {row.company ? (
                  <span className="mt-0.5 block text-xs text-[var(--color-muted)]">{row.company}</span>
                ) : null}
              </Td>
              <Td>{row.openingStock}</Td>
              <Td>{row.issued}</Td>
              <Td>{row.returned}</Td>
              <Td>
                <span
                  className={
                    row.isLow
                      ? 'font-semibold text-[var(--color-danger)]'
                      : 'font-semibold text-[var(--color-primary)]'
                  }
                >
                  {row.available}
                </span>
                {row.isLow ? <Badge tone="danger">Low</Badge> : null}
              </Td>
              <Td>{row.minimumStockAlert}</Td>
              <Td>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    setAdjustFor(row);
                    setQuantityDelta('0');
                    setRemarks('');
                  }}
                >
                  Adjust
                </Button>
              </Td>
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

      <Modal
        open={Boolean(adjustFor)}
        onClose={() => setAdjustFor(null)}
        title="Adjust Inventory Stock"
        description={
          adjustFor
            ? `Manual stock correction for ${adjustFor.medicineName} (Current available: ${adjustFor.available})`
            : undefined
        }
        className="max-w-lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustFor(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="adjust-stock-form"
              loading={adjustMutation.isPending}
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? 'Applying…' : 'Apply Adjustment'}
            </Button>
          </>
        }
      >
        <form id="adjust-stock-form" className="space-y-4" onSubmit={onAdjustSubmit}>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <Input
              label="Quantity Delta"
              type="number"
              required
              placeholder="e.g. +50 or -10"
              hint="Enter positive integer to add stock (+), negative integer to reduce (-)"
              value={quantityDelta}
              onChange={(event) => setQuantityDelta(event.target.value)}
            />
            <Textarea
              label="Adjustment Justification / Reason"
              placeholder="e.g. Physical inventory audit discrepancy, damaged batch removal..."
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              rows={3}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
