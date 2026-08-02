import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
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
      <Card>
        <DataTable
          columns={['Date', 'Medicine', 'Qty', 'Amount', 'Doctor/Store', 'MR']}
          loading={salesQuery.isLoading}
          empty={
            !salesQuery.isLoading && salesQuery.data?.length === 0 ? (
              <EmptyState title="No sales yet" description="Create the first sale entry." />
            ) : null
          }
        >
          {salesQuery.data?.map((sale) => (
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
