import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useClientTable } from '@/hooks/useClientTable';
import { useAuth } from '@/store/AuthContext';
import { doctorsApi, type CreateDoctorPayload } from '@/services/doctors.service';
import { usersApi } from '@/services/users.service';

const emptyForm: CreateDoctorPayload = {
  fullName: '',
  specialization: '',
  hospital: '',
  clinic: '',
  phone: '',
  city: '',
  visitingDays: '',
  preferredTime: '',
};

export function DoctorsPage() {
  const { can } = useAuth();
  const isAdmin = can('doctors:manage');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateDoctorPayload>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);

  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.list(),
  });

  const table = useClientTable({
    data: doctorsQuery.data ?? [],
    searchKeys: ['fullName', 'phone', 'specialization', 'hospital', 'clinic', 'city'],
    getSortValue: (row, key) =>
      key === 'mr' ? row.assignedMrs.map((mr) => mr.fullName).join(', ') : undefined,
    initialSortKey: 'fullName',
  });

  const mrsQuery = useQuery({
    queryKey: ['users', 'for-assign'],
    queryFn: () => usersApi.list(),
    enabled: isAdmin && open,
  });

  const createMutation = useMutation({
    mutationFn: doctorsApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      setOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: doctorsApi.remove,
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success('Doctor deleted');
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
    onError: (err) => {
      setError(getApiErrorMessage(err));
      toast.error('Delete failed', getApiErrorMessage(err));
    },
  });

  function onCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    createMutation.mutate({
      fullName: form.fullName,
      specialization: form.specialization || undefined,
      hospital: form.hospital || undefined,
      clinic: form.clinic || undefined,
      phone: form.phone || undefined,
      city: form.city || undefined,
      visitingDays: form.visitingDays || undefined,
      preferredTime: form.preferredTime || undefined,
      mrId: form.mrId || undefined,
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={isAdmin ? 'Doctor Management' : 'My Doctors'}
        description={
          isAdmin
            ? 'Maintain doctor directory and assign Medical Representatives.'
            : 'Doctors currently assigned to you.'
        }
        actions={
          isAdmin ? (
            <Button onClick={() => setOpen(true)}>
              <Plus size={16} />
              Add Doctor
            </Button>
          ) : null
        }
      />

      {error ? <Alert message={error} /> : null}

      <Card className="p-4">
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search doctors…"
        />
        <DataTable
          columns={[
            { key: 'fullName', label: 'Doctor', sortable: true },
            { key: 'specialization', label: 'Specialization', sortable: true },
            { key: 'visitingDays', label: 'Visiting', sortable: true },
            { key: 'mr', label: 'Assigned MR', sortable: true },
            { key: 'actions', label: 'Actions' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={doctorsQuery.isLoading}
          empty={
            !doctorsQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No doctors found' : 'No matching doctors'}
                description={
                  table.totalAll === 0
                    ? 'Add a doctor to get started.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((doctor) => (
            <tr key={doctor.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td>
                <Link to={`/doctors/${doctor.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                  {doctor.fullName}
                </Link>
                <div className="text-[var(--color-muted)]">{doctor.phone ?? '—'}</div>
              </Td>
              <Td>
                <div>{doctor.specialization ?? '—'}</div>
                <div className="text-[var(--color-muted)]">
                  {[doctor.hospital, doctor.clinic].filter(Boolean).join(' / ') || ''}
                </div>
              </Td>
              <Td>
                <div>{doctor.visitingDays ?? '—'}</div>
                <div className="text-[var(--color-muted)]">{doctor.preferredTime ?? ''}</div>
              </Td>
              <Td>{doctor.assignedMrs.map((mr) => mr.fullName).join(', ') || 'Unassigned'}</Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  <Link to={`/doctors/${doctor.id}`}>
                    <Button variant="secondary" className="!px-2.5 !py-1.5 text-xs">
                      Open
                    </Button>
                  </Link>
                  {isAdmin ? (
                    <Button
                      variant="danger"
                      className="!px-2.5 !py-1.5 text-xs"
                      onClick={() => setDeleteTarget({ id: doctor.id, name: doctor.fullName })}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
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
        open={open}
        onClose={() => setOpen(false)}
        title="Add Doctor"
        description="Capture doctor details and optionally assign an MR."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-doctor-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Doctor'}
            </Button>
          </>
        }
      >
        <form id="create-doctor-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <Input
            label="Full name"
            required
            value={form.fullName}
            onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
          />
          <Input
            label="Specialization"
            value={form.specialization}
            onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
          />
          <Input
            label="Hospital"
            value={form.hospital}
            onChange={(e) => setForm((prev) => ({ ...prev, hospital: e.target.value }))}
          />
          <Input
            label="Clinic"
            value={form.clinic}
            onChange={(e) => setForm((prev) => ({ ...prev, clinic: e.target.value }))}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
          />
          <Input
            label="City"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          />
          <Input
            label="Visiting days"
            placeholder="Mon, Wed, Fri"
            value={form.visitingDays}
            onChange={(e) => setForm((prev) => ({ ...prev, visitingDays: e.target.value }))}
          />
          <Input
            label="Preferred time"
            placeholder="10:00–13:00"
            value={form.preferredTime}
            onChange={(e) => setForm((prev) => ({ ...prev, preferredTime: e.target.value }))}
          />
          <label className="block text-sm font-medium sm:col-span-2">
            Assign MR
            <select
              className="mt-1.5 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-teal-500/20"
              value={form.mrId ?? ''}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  mrId: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            >
              <option value="">Unassigned</option>
              {mrsQuery.data?.map((mr) => (
                <option key={mr.id} value={mr.id}>
                  {mr.fullName} ({mr.email})
                </option>
              ))}
            </select>
          </label>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="delete"
        title="Confirm Delete"
        description={`Are you sure you want to delete doctor “${deleteTarget?.name}”?`}
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
