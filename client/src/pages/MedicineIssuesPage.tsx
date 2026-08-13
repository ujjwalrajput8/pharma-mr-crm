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

  const table = useClientTable({
    data: listQuery.data ?? [],
    getSearchText: (row) =>
      [
        row.id,
        row.issueDate,
        row.mr.fullName,
        row.medicine.name,
        row.batchNumber,
        row.quantity,
        row.remarks,
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'id') return row.id;
      if (key === 'date') return row.issueDate;
      if (key === 'mr') return row.mr.fullName;
      if (key === 'medicine') return row.medicine.name;
      if (key === 'batch') return row.batchNumber;
      if (key === 'quantity') return row.quantity;
      if (key === 'remarks') return row.remarks;
      return undefined;
    },
    initialSortKey: 'date',
    initialSortDir: 'desc',
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

      <Card className="p-4">
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search issues…"
        />
        <DataTable
          columns={[
            { key: 'id', label: 'Issue #', sortable: true },
            { key: 'date', label: 'Date', sortable: true },
            { key: 'mr', label: 'MR', sortable: true },
            { key: 'medicine', label: 'Medicine', sortable: true },
            { key: 'batch', label: 'Batch', sortable: true },
            { key: 'quantity', label: 'Qty', sortable: true },
            { key: 'remarks', label: 'Remarks', sortable: true },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={listQuery.isLoading}
          empty={
            !listQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No issues yet' : 'No matching issues'}
                description={
                  table.totalAll === 0
                    ? 'Issue medicines from company stock to an MR.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((row) => (
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
