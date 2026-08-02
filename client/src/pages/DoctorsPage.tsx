import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
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
  mrId: '',
};

export function DoctorsPage() {
  const { can } = useAuth();
  const isAdmin = can('doctors:manage');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateDoctorPayload>(emptyForm);

  const doctorsQuery = useQuery({
    queryKey: ['doctors', search],
    queryFn: () => doctorsApi.list(search || undefined),
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
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ['doctors'] }),
    onError: (err) => setError(getApiErrorMessage(err)),
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

      <div className="relative max-w-md">
        <Search size={16} className="pointer-events-none absolute top-3.5 left-3.5 text-[var(--color-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search doctors…"
          className="w-full rounded-xl border border-[var(--color-border)] bg-white py-2.5 pr-3 pl-10 text-sm outline-none focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      <Card>
        <DataTable
          columns={
            isAdmin
              ? ['Doctor', 'Specialization', 'Visiting', 'Assigned MR', 'Actions']
              : ['Doctor', 'Specialization', 'Visiting', 'Assigned MR']
          }
          loading={doctorsQuery.isLoading}
          empty={
            !doctorsQuery.isLoading && doctorsQuery.data?.length === 0 ? (
              <EmptyState title="No doctors found" description="Add a doctor to get started." />
            ) : null
          }
        >
          {doctorsQuery.data?.map((doctor) => (
            <tr key={doctor.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td>
                <div className="font-medium">{doctor.fullName}</div>
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
              {isAdmin ? (
                <Td>
                  <Button
                    variant="danger"
                    className="!px-2.5 !py-1.5 text-xs"
                    onClick={() => {
                      if (window.confirm(`Delete ${doctor.fullName}?`)) {
                        deleteMutation.mutate(doctor.id);
                      }
                    }}
                  >
                    Delete
                  </Button>
                </Td>
              ) : null}
            </tr>
          ))}
        </DataTable>
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
              value={form.mrId}
              onChange={(e) => setForm((prev) => ({ ...prev, mrId: e.target.value }))}
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
    </div>
  );
}
