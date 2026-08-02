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
import { medicineIssuesApi, type CreateMedicineIssuePayload } from '@/services/medicine-issues.service';
import { medicinesApi } from '@/services/medicines.service';
import { usersApi } from '@/services/users.service';
import { toIsoDate } from '@/utils/datetime';
import { useAuth } from '@/store/AuthContext';

export function MedicineIssuesPage() {
  const { can } = useAuth();
  const isAdmin = can('medicine-issues:manage');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateMedicineIssuePayload>({
    mrId: 0,
    medicineId: 0,
    quantity: 1,
    batchNumber: '',
    issueDate: toIsoDate(new Date()),
    remarks: '',
  });

  const listQuery = useQuery({
    queryKey: ['medicine-issues'],
    queryFn: () => medicineIssuesApi.list(),
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
    enabled: open && isAdmin,
  });
  const mrsQuery = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: open && isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: medicineIssuesApi.create,
    onSuccess: async () => {
      setOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['medicine-issues'] });
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
      await queryClient.invalidateQueries({ queryKey: ['stock'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!form.mrId || !form.medicineId) {
      setError('Select MR and medicine');
      return;
    }
    createMutation.mutate({
      ...form,
      batchNumber: form.batchNumber || undefined,
      remarks: form.remarks || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Medicine Issue"
        description="Admin issues company samples to MR bag stock. Sample distribution later reduces MR stock."
        actions={
          isAdmin ? (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              Issue to MR
            </Button>
          ) : null
        }
      />
      {error ? <Alert message={error} /> : null}

      <Card>
        <DataTable
          columns={['Issue #', 'Date', 'MR', 'Medicine', 'Batch', 'Qty', 'Remarks']}
          loading={listQuery.isLoading}
          empty={
            !listQuery.isLoading && listQuery.data?.length === 0 ? (
              <EmptyState
                title="No issues yet"
                description="Issue medicines from company stock to an MR."
              />
            ) : null
          }
        >
          {listQuery.data?.map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">#{row.id}</Td>
              <Td>{row.issueDate}</Td>
              <Td>{row.mr.fullName}</Td>
              <Td>{row.medicine.name}</Td>
              <Td>{row.batchNumber || '—'}</Td>
              <Td>{row.quantity}</Td>
              <Td>{row.remarks || '—'}</Td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Issue Medicine to MR"
        description="Company stock decreases; MR stock increases."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="medicine-issue-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Issuing…' : 'Issue'}
            </Button>
          </>
        }
      >
        <form id="medicine-issue-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
          <Select
            label="MR"
            required
            value={form.mrId || ''}
            onChange={(e) => setForm((p) => ({ ...p, mrId: Number(e.target.value) }))}
          >
            <option value="">Select MR</option>
            {mrsQuery.data?.map((mr) => (
              <option key={mr.id} value={mr.id}>
                {mr.fullName}
              </option>
            ))}
          </Select>
          <Select
            label="Medicine"
            required
            value={form.medicineId || ''}
            onChange={(e) => setForm((p) => ({ ...p, medicineId: Number(e.target.value) }))}
          >
            <option value="">Select medicine</option>
            {medicinesQuery.data?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} (stock {m.stock?.available ?? 0})
              </option>
            ))}
          </Select>
          <Input
            label="Quantity"
            type="number"
            min={1}
            required
            value={form.quantity}
            onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
          />
          <Input
            label="Batch"
            value={form.batchNumber}
            onChange={(e) => setForm((p) => ({ ...p, batchNumber: e.target.value }))}
          />
          <DatePicker
            label="Issue Date"
            value={form.issueDate}
            onChange={(value) => setForm((p) => ({ ...p, issueDate: value }))}
          />
          <Input
            label="Remarks"
            value={form.remarks}
            onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  );
}
