import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useClientTable } from '@/hooks/useClientTable';
import { useAuth } from '@/store/AuthContext';
import { doctorsApi, type CreateDoctorPayload, type Doctor } from '@/services/doctors.service';
import { usersApi } from '@/services/users.service';

interface DoctorForm {
  fullName: string;
  specialization: string;
  hospital: string;
  clinic: string;
  phone: string;
  city: string;
  visitingDays: string;
  preferredTime: string;
  birthday: string;
  anniversary: string;
  mrId?: number;
}

const emptyForm: DoctorForm = {
  fullName: '',
  specialization: '',
  hospital: '',
  clinic: '',
  phone: '',
  city: '',
  visitingDays: '',
  preferredTime: '',
  birthday: '',
  anniversary: '',
};

function toForm(doctor: Doctor): DoctorForm {
  return {
    fullName: doctor.fullName,
    specialization: doctor.specialization ?? '',
    hospital: doctor.hospital ?? '',
    clinic: doctor.clinic ?? '',
    phone: doctor.phone ?? '',
    city: doctor.city ?? '',
    visitingDays: doctor.visitingDays ?? '',
    preferredTime: doctor.preferredTime ?? '',
    birthday: doctor.birthday ?? '',
    anniversary: doctor.anniversary ?? '',
  };
}

/** Blank inputs become null so clearing a field on edit actually clears it. */
function toPayload(form: DoctorForm): CreateDoctorPayload {
  const orNull = (value: string): string | null => value.trim() || null;
  return {
    fullName: form.fullName.trim(),
    specialization: orNull(form.specialization),
    hospital: orNull(form.hospital),
    clinic: orNull(form.clinic),
    phone: orNull(form.phone),
    city: orNull(form.city),
    visitingDays: orNull(form.visitingDays),
    preferredTime: orNull(form.preferredTime),
    birthday: form.birthday || null,
    anniversary: form.anniversary || null,
  };
}

export function DoctorsPage() {
  const { can } = useAuth();
  const isAdmin = can('doctors:manage');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyForm);
  /** Set while the modal edits an existing doctor; null while adding. */
  const [editing, setEditing] = useState<Doctor | null>(null);
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
    enabled: isAdmin && open && !editing,
  });

  const createMutation = useMutation({
    mutationFn: doctorsApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      setOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
      await queryClient.invalidateQueries({ queryKey: ['occasions'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CreateDoctorPayload }) =>
      doctorsApi.update(id, payload),
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      setError(null);
      toast.success('Doctor updated');
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
      await queryClient.invalidateQueries({ queryKey: ['occasions'] });
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

  function openCreate(): void {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(doctor: Doctor): void {
    setEditing(doctor);
    setForm(toForm(doctor));
    setOpen(true);
  }

  function closeModal(): void {
    setOpen(false);
    setEditing(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, payload: toPayload(form) });
      return;
    }
    createMutation.mutate({ ...toPayload(form), mrId: form.mrId || undefined });
  }

  const saving = createMutation.isPending || updateMutation.isPending;

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
            <Button onClick={openCreate}>
              <Plus size={16} />
              Add Doctor
            </Button>
          ) : null
        }
      />

      {error ? <Alert message={error} /> : null}

      <Card>
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
                    <Button variant="secondary" size="sm">
                      Open
                    </Button>
                  </Link>
                  {isAdmin ? (
                    <Button variant="secondary" size="sm" onClick={() => openEdit(doctor)}>
                      <Pencil size={13} />
                      Edit
                    </Button>
                  ) : null}
                  {isAdmin ? (
                    <Button
                      variant="danger"
                      size="sm"
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
        onClose={closeModal}
        title={editing ? 'Edit Doctor' : 'Add Doctor'}
        description={
          editing
            ? 'Update the doctor profile, practice details and personal occasions.'
            : 'Register a healthcare professional in the doctor master directory and assign a field representative.'
        }
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button type="submit" form="create-doctor-form" loading={saving}>
              {saving ? 'Saving…' : editing ? 'Save Changes' : 'Register Doctor'}
            </Button>
          </>
        }
      >
        <form id="create-doctor-form" className="space-y-4" onSubmit={onSubmit}>
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
              Doctor Profile & Contact
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Full Name"
                required
                placeholder="Dr. Rajesh Sharma"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
              <Input
                label="Specialization"
                placeholder="e.g. Cardiologist, Physician"
                value={form.specialization}
                onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
              />
              <Input
                label="Phone Number"
                placeholder="+91 98765 43210"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <Input
                label="City / Territory"
                placeholder="e.g. Mumbai, Pune"
                value={form.city}
                onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Practice & Affiliation
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Primary Hospital"
                placeholder="e.g. Apollo Hospital"
                value={form.hospital}
                onChange={(e) => setForm((prev) => ({ ...prev, hospital: e.target.value }))}
              />
              <Input
                label="Private Clinic"
                placeholder="e.g. Sharma Health Clinic"
                value={form.clinic}
                onChange={(e) => setForm((prev) => ({ ...prev, clinic: e.target.value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-pink-500" />
              Birthday & Anniversary
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePicker
                label="Birthday"
                pastDates
                placeholder="YYYY-MM-DD"
                value={form.birthday}
                onChange={(value) => setForm((prev) => ({ ...prev, birthday: value }))}
              />
              <DatePicker
                label="Wedding Anniversary"
                pastDates
                placeholder="YYYY-MM-DD"
                value={form.anniversary}
                onChange={(value) => setForm((prev) => ({ ...prev, anniversary: value }))}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {editing ? 'Visiting Schedule' : 'Visiting Schedule & MR Assignment'}
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Visiting Days"
                placeholder="Mon, Wed, Fri"
                value={form.visitingDays}
                onChange={(e) => setForm((prev) => ({ ...prev, visitingDays: e.target.value }))}
              />
              <Input
                label="Preferred Time Window"
                placeholder="10:00 AM – 01:00 PM"
                value={form.preferredTime}
                onChange={(e) => setForm((prev) => ({ ...prev, preferredTime: e.target.value }))}
              />
              {editing ? null : (
                <Select
                  label="Assign Field Representative (MR)"
                  className="sm:col-span-2"
                  value={form.mrId ?? ''}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      mrId: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                >
                  <option value="">Unassigned (Open Pool)</option>
                  {mrsQuery.data?.map((mr) => (
                    <option key={mr.id} value={mr.id}>
                      {mr.fullName} ({mr.email})
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
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
