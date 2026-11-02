import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileSpreadsheet, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { DoctorImportDialog } from '@/components/doctors/DoctorImportDialog';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useClientTable } from '@/hooks/useClientTable';
import { useAuth } from '@/store/AuthContext';
import {
  DOCTOR_AREA_TYPE_LABEL,
  doctorsApi,
  type CreateDoctorPayload,
  type Doctor,
  type DoctorAreaType,
} from '@/services/doctors.service';
import { usersApi } from '@/services/users.service';

/** Same fields, same order, as the company MSL sheet. */
interface DoctorForm {
  mslNo: string;
  area: string;
  areaType: DoctorAreaType | '';
  fullName: string;
  phone: string;
  mslClass: string;
  specialization: string;
  address: string;
  email: string;
  birthday: string;
  anniversary: string;
  mrId?: number;
}

const emptyForm: DoctorForm = {
  mslNo: '',
  area: '',
  areaType: '',
  fullName: '',
  phone: '',
  mslClass: '',
  specialization: '',
  address: '',
  email: '',
  birthday: '',
  anniversary: '',
};

function toForm(doctor: Doctor): DoctorForm {
  return {
    mslNo: doctor.mslNo ?? '',
    area: doctor.area ?? '',
    areaType: doctor.areaType ?? '',
    fullName: doctor.fullName,
    phone: doctor.phone ?? '',
    mslClass: doctor.mslClass ?? '',
    specialization: doctor.specialization ?? '',
    address: doctor.address ?? '',
    email: doctor.email ?? '',
    birthday: doctor.birthday ?? '',
    anniversary: doctor.anniversary ?? '',
  };
}

/** Blank inputs become null so clearing a field on edit actually clears it. */
function toPayload(form: DoctorForm): CreateDoctorPayload {
  const orNull = (value: string): string | null => value.trim() || null;
  return {
    mslNo: orNull(form.mslNo),
    area: orNull(form.area),
    areaType: form.areaType || null,
    fullName: form.fullName.trim(),
    phone: orNull(form.phone),
    mslClass: orNull(form.mslClass),
    specialization: orNull(form.specialization),
    address: orNull(form.address),
    email: orNull(form.email),
    birthday: form.birthday || null,
    anniversary: form.anniversary || null,
  };
}

const MSL_CLASS_OPTIONS = ['A', 'B', 'C'];

export function DoctorsPage() {
  const { can } = useAuth();
  const isAdmin = can('doctors:manage');
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<DoctorForm>(emptyForm);
  /** Set while the modal edits an existing doctor; null while adding. */
  const [editing, setEditing] = useState<Doctor | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.list(),
  });

  const table = useClientTable({
    data: doctorsQuery.data ?? [],
    searchKeys: ['mslNo', 'fullName', 'phone', 'area', 'mslClass', 'specialization', 'email'],
    getSortValue: (row, key) =>
      key === 'mr' ? row.assignedMrs.map((mr) => mr.fullName).join(', ') : undefined,
    // MSL order, the way the sheet reads; doctors without an MSL No go last.
    initialSortKey: 'mslNo',
    // Starred doctors stay on top whichever column is sorted.
    pinFirst: (row) => row.isFavorite,
  });

  const mrsQuery = useQuery({
    queryKey: ['users', 'for-assign', 'MR'],
    queryFn: () => usersApi.list({ role: 'MR' }),
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

  /** Flips the star at once; rolls back if the server says no. */
  const favoriteMutation = useMutation({
    mutationFn: ({ id, favorite }: { id: number; favorite: boolean }) =>
      doctorsApi.setFavorite(id, favorite),
    onMutate: async ({ id, favorite }) => {
      await queryClient.cancelQueries({ queryKey: ['doctors'] });
      const previous = queryClient.getQueryData<Doctor[]>(['doctors']);
      queryClient.setQueryData<Doctor[]>(['doctors'], (rows) =>
        rows?.map((row) => (row.id === id ? { ...row, isFavorite: favorite } : row)),
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['doctors'], context.previous);
      toast.error('Could not update favourite', getApiErrorMessage(err));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
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
            <>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <FileSpreadsheet size={16} />
                Import Excel
              </Button>
              <Button onClick={openCreate}>
                <Plus size={16} />
                Add Doctor
              </Button>
            </>
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
            { key: 'favorite', label: 'Fav', className: 'w-px text-center' },
            { key: 'mslNo', label: 'MSL No', sortable: true },
            { key: 'fullName', label: 'Doctor', sortable: true },
            { key: 'area', label: 'Area', sortable: true },
            { key: 'mslClass', label: 'Class', sortable: true },
            { key: 'specialization', label: 'Speciality', sortable: true },
            { key: 'mr', label: 'Assigned MR', sortable: true },
            { key: 'actions', label: 'Actions', className: 'w-px text-right' },
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
            <tr
              key={doctor.id}
              className="border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-bg)]/60"
            >
              <Td className="text-center">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={doctor.isFavorite ? `Remove ${doctor.fullName} from favourites` : `Add ${doctor.fullName} to favourites`}
                  aria-pressed={doctor.isFavorite}
                  title={doctor.isFavorite ? 'Remove from favourites' : 'Add to favourites'}
                  className="hover:bg-[var(--color-warning-soft)] hover:text-[var(--color-warning)]"
                  onClick={() => favoriteMutation.mutate({ id: doctor.id, favorite: !doctor.isFavorite })}
                >
                  <Star
                    size={15}
                    className={
                      doctor.isFavorite ? 'fill-[var(--color-warning)] text-[var(--color-warning)]' : undefined
                    }
                  />
                </Button>
              </Td>
              <Td className="font-mono">{doctor.mslNo ?? '—'}</Td>
              <Td>
                <Link to={`/doctors/${doctor.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                  {doctor.fullName}
                </Link>
                <div className="text-[var(--color-muted)]">{doctor.phone ?? '—'}</div>
              </Td>
              <Td>
                <div>{doctor.area ?? '—'}</div>
                {doctor.areaType ? (
                  <div className="text-[var(--color-muted)]">{DOCTOR_AREA_TYPE_LABEL[doctor.areaType]}</div>
                ) : null}
              </Td>
              <Td>{doctor.mslClass ? <Badge tone="primary">{doctor.mslClass}</Badge> : '—'}</Td>
              <Td>{doctor.specialization ?? '—'}</Td>
              <Td>{doctor.assignedMrs.map((mr) => mr.fullName).join(', ') || 'Unassigned'}</Td>
              <Td className="text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="icon-sm"
                    variant="soft"
                    aria-label={`Open ${doctor.fullName}`}
                    title="Open"
                    onClick={() => navigate(`/doctors/${doctor.id}`)}
                  >
                    <Eye size={14} />
                  </Button>
                  {isAdmin ? (
                    <>
                      <Button
                        size="icon-sm"
                        variant="warning"
                        aria-label={`Edit ${doctor.fullName}`}
                        title="Edit"
                        onClick={() => openEdit(doctor)}
                      >
                        <Pencil size={13} />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="danger"
                        aria-label={`Delete ${doctor.fullName}`}
                        title="Delete"
                        onClick={() => setDeleteTarget({ id: doctor.id, name: doctor.fullName })}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </>
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
            ? "Update the doctor's MSL details, contact and personal occasions."
            : 'Add a doctor to the MSL directory and assign a field representative.'
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
              MSL Details
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="MSL No"
                placeholder="e.g. M001"
                value={form.mslNo}
                onChange={(e) => setForm((prev) => ({ ...prev, mslNo: e.target.value }))}
              />
              <Input
                label="MSL Class"
                placeholder="A / B / C"
                list="doctor-msl-class-options"
                value={form.mslClass}
                onChange={(e) => setForm((prev) => ({ ...prev, mslClass: e.target.value }))}
              />
              <datalist id="doctor-msl-class-options">
                {MSL_CLASS_OPTIONS.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
              <Input
                label="Area"
                placeholder="e.g. Boring Road"
                value={form.area}
                onChange={(e) => setForm((prev) => ({ ...prev, area: e.target.value }))}
              />
              <Select
                label="HQ / EX"
                value={form.areaType}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, areaType: e.target.value as DoctorAreaType | '' }))
                }
              >
                <option value="">Not set</option>
                {(Object.keys(DOCTOR_AREA_TYPE_LABEL) as DoctorAreaType[]).map((type) => (
                  <option key={type} value={type}>
                    {DOCTOR_AREA_TYPE_LABEL[type]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-teal-500" />
              Doctor Profile & Contact
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label="Doctor's Name"
                required
                placeholder="Dr. Rajesh Sharma"
                value={form.fullName}
                onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              />
              <Input
                label="Speciality"
                placeholder="e.g. Cardiologist, Physician"
                value={form.specialization}
                onChange={(e) => setForm((prev) => ({ ...prev, specialization: e.target.value }))}
              />
              <Input
                label="Mobile No"
                placeholder="98765 43210"
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
              <Input
                label="Email ID"
                type="email"
                placeholder="doctor@example.com"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              />
              <Textarea
                label="Address"
                className="sm:col-span-2"
                rows={2}
                placeholder="Clinic / residence address"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
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
                label="Anniversary"
                pastDates
                placeholder="YYYY-MM-DD"
                value={form.anniversary}
                onChange={(value) => setForm((prev) => ({ ...prev, anniversary: value }))}
              />
            </div>
          </div>

          {editing ? null : (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                MR Assignment
              </h4>
              <Select
                label="Assign Field Representative (MR)"
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
            </div>
          )}
        </form>
      </Modal>

      <DoctorImportDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        variant="delete"
        recordName={deleteTarget?.name}
        recordContext="Doctor Management"
        loading={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </div>
  );
}
