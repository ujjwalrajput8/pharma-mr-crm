import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { useAuth } from '@/store/AuthContext';
import {
  appointmentsApi,
  type Appointment,
  type AppointmentStatus,
  type CompleteAppointmentPayload,
  type CreateAppointmentPayload,
} from '@/services/appointments.service';
import { doctorsApi } from '@/services/doctors.service';
import { medicinesApi } from '@/services/medicines.service';
import { usersApi } from '@/services/users.service';

const statusTone: Record<AppointmentStatus, 'primary' | 'success' | 'danger'> = {
  PENDING: 'primary',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

export function AppointmentsPage() {
  const { can, user } = useAuth();
  const isAdmin = can('appointments:manage');
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateAppointmentPayload>({
    doctorId: '',
    mrId: '',
    date: '',
    time: '10:00',
    purpose: '',
    remarks: '',
  });
  const [completeForm, setCompleteForm] = useState<CompleteAppointmentPayload>({
    visitDate: '',
    visitTime: '11:00',
    meetingDurationMin: 30,
    discussionNotes: '',
    doctorFeedback: '',
    nextFollowUp: '',
    remarks: '',
    medicineIds: [],
    distributions: [],
  });

  const appointmentsQuery = useQuery({
    queryKey: ['appointments'],
    queryFn: () => appointmentsApi.list(),
  });
  const doctorsQuery = useQuery({
    queryKey: ['doctors', 'for-appointments'],
    queryFn: () => doctorsApi.list(),
    enabled: open || Boolean(completeFor),
  });
  const mrsQuery = useQuery({
    queryKey: ['users', 'for-appointments'],
    queryFn: () => usersApi.list(),
    enabled: open && isAdmin,
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines', 'for-complete'],
    queryFn: () => medicinesApi.list(),
    enabled: Boolean(completeFor),
  });

  const createMutation = useMutation({
    mutationFn: appointmentsApi.create,
    onSuccess: async () => {
      setOpen(false);
      setForm({ doctorId: '', mrId: '', date: '', time: '10:00', purpose: '', remarks: '' });
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'CANCELLED' }) =>
      appointmentsApi.updateStatus(id, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CompleteAppointmentPayload }) =>
      appointmentsApi.complete(id, payload),
    onSuccess: async () => {
      setCompleteFor(null);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['appointments'] });
      await queryClient.invalidateQueries({ queryKey: ['visits'] });
      await queryClient.invalidateQueries({ queryKey: ['medicines'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const title = useMemo(
    () => (isAdmin ? 'Appointment Management' : 'My Appointments'),
    [isAdmin],
  );

  function onCreate(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    createMutation.mutate({
      doctorId: form.doctorId,
      date: form.date,
      time: form.time,
      purpose: form.purpose || undefined,
      remarks: form.remarks || undefined,
      mrId: isAdmin ? form.mrId || undefined : user?.id,
    });
  }

  function onComplete(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!completeFor) return;
    completeMutation.mutate({
      id: completeFor.id,
      payload: {
        ...completeForm,
        discussionNotes: completeForm.discussionNotes || undefined,
        doctorFeedback: completeForm.doctorFeedback || undefined,
        nextFollowUp: completeForm.nextFollowUp || undefined,
        remarks: completeForm.remarks || undefined,
        medicineIds: completeForm.medicineIds ?? [],
        distributions: completeForm.distributions ?? [],
      },
    });
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description="Appointments are for scheduling only. Completing one creates the Visit."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={16} />
            New Appointment
          </Button>
        }
      />

      {error ? <Alert message={error} /> : null}

      <Card>
        <DataTable
          columns={['Date', 'Time', 'Doctor', 'Purpose', 'Status', 'Actions']}
          loading={appointmentsQuery.isLoading}
          empty={
            !appointmentsQuery.isLoading && appointmentsQuery.data?.length === 0 ? (
              <EmptyState
                title="No appointments yet"
                description="Schedule an appointment with a doctor."
              />
            ) : null
          }
        >
          {appointmentsQuery.data?.map((item) => (
            <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{item.date}</Td>
              <Td>{item.time}</Td>
              <Td>{item.doctor?.fullName ?? '—'}</Td>
              <Td>{item.purpose ?? '—'}</Td>
              <Td>
                <Badge tone={statusTone[item.status]}>{item.status}</Badge>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-2">
                  {item.status === 'PENDING' ? (
                    <>
                      <Button
                        variant="primary"
                        className="!px-2.5 !py-1.5 text-xs"
                        onClick={() => {
                          setCompleteFor(item);
                          setCompleteForm((prev) => ({
                            ...prev,
                            visitDate: item.date,
                            visitTime: item.time,
                          }));
                        }}
                      >
                        Complete + Visit
                      </Button>
                      <Button
                        variant="secondary"
                        className="!px-2.5 !py-1.5 text-xs"
                        onClick={() => statusMutation.mutate({ id: item.id, status: 'CANCELLED' })}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule Appointment"
        description="This only schedules the meeting — it does not log a visit yet."
        className="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-appointment-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Saving…' : 'Save Appointment'}
            </Button>
          </>
        }
      >
        <form id="create-appointment-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <Select
            label="Doctor"
            required
            className="sm:col-span-2"
            value={form.doctorId}
            onChange={(e) => setForm((prev) => ({ ...prev, doctorId: e.target.value }))}
          >
            <option value="">Select doctor</option>
            {doctorsQuery.data?.map((doctor) => (
              <option key={doctor.id} value={doctor.id}>
                {doctor.fullName}
              </option>
            ))}
          </Select>
          {isAdmin ? (
            <Select
              label="Medical Representative"
              required
              className="sm:col-span-2"
              value={form.mrId}
              onChange={(e) => setForm((prev) => ({ ...prev, mrId: e.target.value }))}
            >
              <option value="">Select MR</option>
              {mrsQuery.data?.map((mr) => (
                <option key={mr.id} value={mr.id}>
                  {mr.fullName}
                </option>
              ))}
            </Select>
          ) : null}
          <Input
            label="Date"
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
          />
          <Input
            label="Time"
            type="time"
            required
            value={form.time}
            onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))}
          />
          <Input
            label="Purpose"
            className="sm:col-span-2"
            value={form.purpose}
            onChange={(e) => setForm((prev) => ({ ...prev, purpose: e.target.value }))}
          />
          <Textarea
            label="Remarks"
            className="sm:col-span-2"
            value={form.remarks}
            onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))}
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(completeFor)}
        onClose={() => setCompleteFor(null)}
        title="Complete Appointment & Log Visit"
        description="Creates the Visit record. Sample distribution will reduce stock automatically."
        className="max-w-2xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCompleteFor(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="complete-appointment-form"
              disabled={completeMutation.isPending}
            >
              {completeMutation.isPending ? 'Saving…' : 'Complete & Save Visit'}
            </Button>
          </>
        }
      >
        <form id="complete-appointment-form" className="grid gap-3 sm:grid-cols-2" onSubmit={onComplete}>
          <Input
            label="Visit date"
            type="date"
            required
            value={completeForm.visitDate}
            onChange={(e) => setCompleteForm((prev) => ({ ...prev, visitDate: e.target.value }))}
          />
          <Input
            label="Visit time"
            type="time"
            required
            value={completeForm.visitTime}
            onChange={(e) => setCompleteForm((prev) => ({ ...prev, visitTime: e.target.value }))}
          />
          <Input
            label="Meeting duration (minutes)"
            type="number"
            min={1}
            value={completeForm.meetingDurationMin ?? ''}
            onChange={(e) =>
              setCompleteForm((prev) => ({
                ...prev,
                meetingDurationMin: Number(e.target.value) || undefined,
              }))
            }
          />
          <Input
            label="Next follow-up"
            type="date"
            value={completeForm.nextFollowUp}
            onChange={(e) => setCompleteForm((prev) => ({ ...prev, nextFollowUp: e.target.value }))}
          />
          <Textarea
            label="Discussion notes"
            className="sm:col-span-2"
            value={completeForm.discussionNotes}
            onChange={(e) =>
              setCompleteForm((prev) => ({ ...prev, discussionNotes: e.target.value }))
            }
          />
          <Textarea
            label="Doctor feedback"
            className="sm:col-span-2"
            value={completeForm.doctorFeedback}
            onChange={(e) =>
              setCompleteForm((prev) => ({ ...prev, doctorFeedback: e.target.value }))
            }
          />
          <label className="block text-sm font-medium sm:col-span-2">
            Products discussed
            <select
              multiple
              className="mt-1.5 min-h-24 w-full rounded-xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm"
              value={completeForm.medicineIds}
              onChange={(e) =>
                setCompleteForm((prev) => ({
                  ...prev,
                  medicineIds: Array.from(e.target.selectedOptions).map((o) => o.value),
                }))
              }
            >
              {medicinesQuery.data?.map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium sm:col-span-2">
            Sample distribution (medicine + qty)
            <div className="mt-2 space-y-2">
              {(completeForm.distributions ?? []).map((row, index) => (
                <div key={index} className="grid grid-cols-3 gap-2">
                  <select
                    className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
                    value={row.medicineId}
                    onChange={(e) => {
                      const next = [...(completeForm.distributions ?? [])];
                      next[index] = { ...row, medicineId: e.target.value };
                      setCompleteForm((prev) => ({ ...prev, distributions: next }));
                    }}
                  >
                    <option value="">Medicine</option>
                    {medicinesQuery.data?.map((medicine) => (
                      <option key={medicine.id} value={medicine.id}>
                        {medicine.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
                    value={row.quantity}
                    onChange={(e) => {
                      const next = [...(completeForm.distributions ?? [])];
                      next[index] = { ...row, quantity: Number(e.target.value) };
                      setCompleteForm((prev) => ({ ...prev, distributions: next }));
                    }}
                  />
                  <input
                    placeholder="Batch no."
                    className="rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
                    value={row.batchNumber ?? ''}
                    onChange={(e) => {
                      const next = [...(completeForm.distributions ?? [])];
                      next[index] = { ...row, batchNumber: e.target.value };
                      setCompleteForm((prev) => ({ ...prev, distributions: next }));
                    }}
                  />
                </div>
              ))}
              <Button
                variant="secondary"
                className="!py-1.5 text-xs"
                onClick={() =>
                  setCompleteForm((prev) => ({
                    ...prev,
                    distributions: [
                      ...(prev.distributions ?? []),
                      { medicineId: '', quantity: 1, batchNumber: '' },
                    ],
                  }))
                }
              >
                Add sample line
              </Button>
            </div>
          </label>
        </form>
      </Modal>
    </div>
  );
}
