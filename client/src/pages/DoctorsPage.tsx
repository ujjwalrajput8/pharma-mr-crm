import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, FileSpreadsheet, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
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
import { formatDisplayDate } from '@/utils/datetime';

/** Same fields, same order, as the company MSL sheet — MSL No is the system's. */
interface DoctorForm {
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
    mrId: doctor.assignedMrs[0]?.id,
  };
}

/** Blank inputs become null so clearing a field on edit actually clears it. */
function toPayload(form: DoctorForm): CreateDoctorPayload {
  const orNull = (value: string): string | null => value.trim() || null;
  return {
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

/** A compact select that sits beside the toolbar's search box. */
const TOOLBAR_SELECT =
  'h-9.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-ink)] shadow-xs outline-none focus:border-[var(--color-primary)] focus:ring-3 focus:ring-[var(--color-primary)]/15';

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
  /** 'all', 'unassigned' or an MR's id. */
  const [mrFilter, setMrFilter] = useState('all');
  /** Doctors ticked for a bulk MR assignment. */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkMrId, setBulkMrId] = useState('');

  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.list(),
  });

  const filteredDoctors = useMemo(() => {
    const rows = doctorsQuery.data ?? [];
    if (mrFilter === 'all') return rows;
    if (mrFilter === 'unassigned') return rows.filter((row) => row.assignedMrs.length === 0);
    return rows.filter((row) => row.assignedMrs.some((mr) => String(mr.id) === mrFilter));
  }, [doctorsQuery.data, mrFilter]);

  const table = useClientTable({
    data: filteredDoctors,
    searchKeys: ['mslNo', 'fullName', 'phone', 'area', 'mslClass', 'specialization', 'address', 'email'],
    getSortValue: (row, key) =>
      key === 'mr' ? row.assignedMrs.map((mr) => mr.fullName).join(', ') : undefined,
    // MSL order, the way the sheet reads; doctors without an MSL No go last.
    initialSortKey: 'mslNo',
    // Starred doctors stay on top whichever column is sorted.
    pinFirst: (row) => row.isFavorite,
  });

  // The filter, the bulk bar and the form all pick from this list.
  const mrsQuery = useQuery({
    queryKey: ['users', 'for-assign', 'MR'],
    queryFn: () => usersApi.list({ role: 'MR' }),
    enabled: isAdmin,
  });

  const bulkAssignMutation = useMutation({
    mutationFn: (mrId: number | null) => doctorsApi.assignMr([...selected], mrId),
    onSuccess: async (result) => {
      toast.success(
        result.mr
          ? `${result.doctors} doctor${result.doctors === 1 ? '' : 's'} assigned to ${result.mr.fullName}`
          : `${result.doctors} doctor${result.doctors === 1 ? '' : 's'} unassigned`,
      );
      setSelected(new Set());
      setBulkMrId('');
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
    },
    onError: (err) => toast.error('Could not assign', getApiErrorMessage(err)),
  });

  function toggleSelected(id: number): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allFilteredSelected =
    table.allRows.length > 0 && table.allRows.every((row) => selected.has(row.id));

  const createMutation = useMutation({
    mutationFn: doctorsApi.create,
    onSuccess: async () => {
      setForm(emptyForm);
      setOpen(false);
      setError(null);
      toast.success('Doctor added');
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
      await queryClient.invalidateQueries({ queryKey: ['occasions'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: Parameters<typeof doctorsApi.update>[1] }) =>
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
    setError(null);
    setOpen(true);
  }

  function openEdit(doctor: Doctor): void {
    setEditing(doctor);
    setForm(toForm(doctor));
    setError(null);
    setOpen(true);
  }

  function closeModal(): void {
    setOpen(false);
    setEditing(null);
    setError(null);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (editing) {
      // Send the MR only when it changed — "Unassigned" (no id) takes the doctor off their MR.
      const mrChanged = (form.mrId ?? null) !== (editing.assignedMrs[0]?.id ?? null);
      updateMutation.mutate({
        id: editing.id,
        payload: { ...toPayload(form), ...(mrChanged ? { mrId: form.mrId ?? null } : {}) },
      });
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

      {error && !open ? <Alert message={error} /> : null}

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search doctors…"
          actions={
            isAdmin ? (
              <select
                aria-label="Filter by MR"
                value={mrFilter}
                onChange={(e) => {
                  setMrFilter(e.target.value);
                  setSelected(new Set());
                }}
                className={TOOLBAR_SELECT}
              >
                <option value="all">All doctors</option>
                <option value="unassigned">Unassigned only</option>
                {mrsQuery.data?.map((mr) => (
                  <option key={mr.id} value={String(mr.id)}>
                    {mr.fullName}
                  </option>
                ))}
              </select>
            ) : null
          }
        />
        {isAdmin && table.allRows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg)]/50 px-4 py-2.5">
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={() =>
                  setSelected(allFilteredSelected ? new Set() : new Set(table.allRows.map((row) => row.id)))
                }
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
              {selected.size > 0 ? `${selected.size} selected` : `Select all ${table.allRows.length}`}
            </label>
            {selected.size > 0 ? (
              <>
                <select
                  aria-label="MR to assign"
                  value={bulkMrId}
                  onChange={(e) => setBulkMrId(e.target.value)}
                  className={TOOLBAR_SELECT}
                >
                  <option value="">Choose MR…</option>
                  {mrsQuery.data?.map((mr) => (
                    <option key={mr.id} value={String(mr.id)}>
                      {mr.fullName}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!bulkMrId}
                  loading={bulkAssignMutation.isPending}
                  onClick={() => bulkAssignMutation.mutate(Number(bulkMrId))}
                >
                  Assign
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={bulkAssignMutation.isPending}
                  onClick={() => bulkAssignMutation.mutate(null)}
                >
                  Unassign
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              </>
            ) : (
              <span className="text-xs text-[var(--color-muted)]">
                Tick doctors to give them to an MR in one go.
              </span>
            )}
          </div>
        ) : null}
        <DataTable
          columns={[
            ...(isAdmin ? [{ key: 'select', label: '', className: 'w-px' }] : []),
            { key: 'favorite', label: 'Fav', className: 'w-px text-center' },
            // Same headings, same order, as the company MSL sheet.
            { key: 'mslNo', label: 'MYMSL NO', sortable: true },
            { key: 'area', label: 'AREA-HQ/EX', sortable: true },
            { key: 'fullName', label: "DOCTOR'S NAME", sortable: true },
            { key: 'phone', label: 'MOBILE NO', sortable: true },
            { key: 'mslClass', label: 'MSLCLASS', sortable: true },
            { key: 'specialization', label: 'SPECIALITY', sortable: true },
            { key: 'address', label: 'ADDRESS', sortable: true },
            { key: 'email', label: 'EMAIL ID', sortable: true },
            { key: 'birthday', label: 'BIRTHDAY', sortable: true },
            { key: 'anniversary', label: 'ANNIVERSARY', sortable: true },
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
              {isAdmin ? (
                <Td className="w-px">
                  <input
                    type="checkbox"
                    aria-label={`Select ${doctor.fullName}`}
                    checked={selected.has(doctor.id)}
                    onChange={() => toggleSelected(doctor.id)}
                    className="h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
                  />
                </Td>
              ) : null}
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
              <Td className="font-mono whitespace-nowrap">{doctor.mslNo ?? '—'}</Td>
              <Td className="whitespace-nowrap">
                {doctor.area ?? '—'}
                {doctor.areaType ? (
                  <span
                    title={DOCTOR_AREA_TYPE_LABEL[doctor.areaType]}
                    className="ml-1.5 rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-muted)]"
                  >
                    {doctor.areaType}
                  </span>
                ) : null}
              </Td>
              <Td className="whitespace-nowrap">
                <Link to={`/doctors/${doctor.id}`} className="font-medium text-[var(--color-primary)] hover:underline">
                  {doctor.fullName}
                </Link>
              </Td>
              <Td className="whitespace-nowrap">{doctor.phone ?? '—'}</Td>
              <Td>{doctor.mslClass ? <Badge tone="primary">{doctor.mslClass}</Badge> : '—'}</Td>
              <Td className="whitespace-nowrap">{doctor.specialization ?? '—'}</Td>
              <Td>
                <span className="block max-w-[16rem] truncate" title={doctor.address ?? undefined}>
                  {doctor.address ?? '—'}
                </span>
              </Td>
              <Td className="whitespace-nowrap">{doctor.email ?? '—'}</Td>
              <Td className="whitespace-nowrap">
                {doctor.birthday ? formatDisplayDate(doctor.birthday) : '—'}
              </Td>
              <Td className="whitespace-nowrap">
                {doctor.anniversary ? formatDisplayDate(doctor.anniversary) : '—'}
              </Td>
              <Td className="whitespace-nowrap">
                {doctor.assignedMrs.length > 0 ? (
                  doctor.assignedMrs.map((mr) => mr.fullName).join(', ')
                ) : (
                  <Badge tone="warning">Unassigned</Badge>
                )}
              </Td>
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
        error={error}
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
                value={editing?.mslNo ?? 'Assigned on save'}
                hint="Given by the system (JL-001, JL-002 …)"
                readOnly
                disabled
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
