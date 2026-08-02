import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
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
        <DataTable
          columns={['Medicine', 'Opening', 'Issued', 'Returned', 'Available', 'Min Alert', 'Actions']}
          loading={stockQuery.isLoading}
          empty={
            !stockQuery.isLoading && stockQuery.data?.length === 0 ? (
              <EmptyState
                title="No stock records"
                description="Add medicines first to see inventory here."
              />
            ) : null
          }
        >
          {stockQuery.data?.map((row) => (
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
                  className="!px-2.5 !py-1.5 text-xs"
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
      </Card>

      <Modal
        open={Boolean(adjustFor)}
        onClose={() => setAdjustFor(null)}
        title="Adjust stock"
        description={
          adjustFor
            ? `${adjustFor.medicineName} — current available: ${adjustFor.available}`
            : undefined
        }
      >
        <form className="space-y-4" onSubmit={onAdjustSubmit}>
          <Input
            label="Quantity delta (+ add / − remove)"
            type="number"
            required
            value={quantityDelta}
            onChange={(event) => setQuantityDelta(event.target.value)}
          />
          <Textarea
            label="Remarks"
            value={remarks}
            onChange={(event) => setRemarks(event.target.value)}
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAdjustFor(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={adjustMutation.isPending}>
              {adjustMutation.isPending ? 'Saving…' : 'Apply adjustment'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
