import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { Input, Select } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { useAuth } from '@/store/AuthContext';
import { doctorsApi } from '@/services/doctors.service';
import { medicinesApi } from '@/services/medicines.service';
import { storesApi } from '@/services/stores.service';
import { salesApi, type CreateSalePayload } from '@/services/sales.service';
import { usersApi } from '@/services/users.service';
import { toIsoDate } from '@/utils/datetime';

export function SalesPage() {
  const { can, user } = useAuth();
  const isAdmin = can('users:manage');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateSalePayload>({
    medicineId: 0,
    quantity: 1,
    amount: 0,
    invoiceDate: toIsoDate(new Date()),
    doctorId: undefined,
    medicalStoreId: undefined,
    mrId: undefined,
  });

  const salesQuery = useQuery({ queryKey: ['sales'], queryFn: () => salesApi.list() });

  const table = useClientTable({
    data: salesQuery.data ?? [],
    getSearchText: (sale) =>
      [
        sale.invoiceDate,
        sale.medicine.name,
        sale.quantity,
        sale.amount,
        sale.doctor?.fullName,
        sale.medicalStore?.name,
        sale.mr.fullName,
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'date') return row.invoiceDate;
      if (key === 'medicine') return row.medicine.name;
      if (key === 'quantity') return row.quantity;
      if (key === 'amount') return row.amount;
      if (key === 'doctorStore') return row.doctor?.fullName ?? row.medicalStore?.name;
      if (key === 'mr') return row.mr.fullName;
      return undefined;
    },
    initialSortKey: 'date',
    initialSortDir: 'desc',
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
    enabled: open,
  });
  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.list(),
    enabled: open,
  });
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesApi.list(),
    enabled: open,
  });
  const mrsQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: open && isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: salesApi.create,
    onSuccess: async () => {
      setOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['sales'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      doctorId: form.doctorId || undefined,
      medicalStoreId: form.medicalStoreId || undefined,
      mrId: isAdmin ? form.mrId || undefined : user?.id,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales"
        description="Record doctor/store medicine sales with amount and invoice date."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} /> Add Sale
          </Button>
        }
      />
      {error ? <Alert message={error} /> : null}
      <Card className="p-4">
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search sales…"
        />
        <DataTable
          columns={[
            { key: 'date', label: 'Date', sortable: true },
            { key: 'medicine', label: 'Medicine', sortable: true },
            { key: 'quantity', label: 'Qty', sortable: true },
            { key: 'amount', label: 'Amount', sortable: true },
            { key: 'doctorStore', label: 'Doctor/Store', sortable: true },
            { key: 'mr', label: 'MR', sortable: true },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={salesQuery.isLoading}
          empty={
            !salesQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No sales yet' : 'No matching sales'}
                description={
                  table.totalAll === 0
                    ? 'Create the first sale entry.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((sale) => (
            <tr key={sale.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td>{sale.invoiceDate}</Td>
              <Td>{sale.medicine.name}</Td>
              <Td>{sale.quantity}</Td>
              <Td>₹{sale.amount.toFixed(2)}</Td>
              <Td>{sale.doctor?.fullName ?? sale.medicalStore?.name ?? '—'}</Td>
              <Td>{sale.mr.fullName}</Td>
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
        open={open}
        onClose={() => setOpen(false)}
        title="Sales Entry"
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="sale-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Sale'}
            </Button>
          </>
        }
      >
        <form id="sale-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
          <Select
            label="Medicine"
            required
            className="sm:col-span-2"
            value={form.medicineId}
            onChange={(e) => setForm((p) => ({ ...p, medicineId: Number(e.target.value) }))}
          >
            <option value="">Select medicine</option>
            {medicinesQuery.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
          <Select
            label="Doctor"
            value={form.doctorId ?? ''}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                doctorId: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">None</option>
            {doctorsQuery.data?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </Select>
          <Select
            label="Medical Store"
            value={form.medicalStoreId ?? ''}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                medicalStoreId: e.target.value ? Number(e.target.value) : undefined,
              }))
            }
          >
            <option value="">None</option>
            {storesQuery.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          {isAdmin ? (
            <Select
              label="MR"
              required
              className="sm:col-span-2"
              value={form.mrId ?? ''}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  mrId: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            >
              <option value="">Select MR</option>
              {mrsQuery.data?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </Select>
          ) : null}
          <Input
            label="Quantity"
            type="number"
            min={1}
            required
            value={form.quantity}
            onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
          />
          <Input
            label="Amount"
            type="number"
            min={0}
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: Number(e.target.value) }))}
          />
          <DatePicker
            label="Invoice Date"
            required
            value={form.invoiceDate}
            onChange={(invoiceDate) => setForm((p) => ({ ...p, invoiceDate }))}
          />
          <Input
            label="Invoice No."
            value={form.invoiceNumber ?? ''}
            onChange={(e) => setForm((p) => ({ ...p, invoiceNumber: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
