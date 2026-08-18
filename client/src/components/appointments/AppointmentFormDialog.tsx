import { useEffect, useState, type FormEvent } from 'react';
import { Calendar, Clock, FileText, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { FormSection, Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TimePicker } from '@/components/ui/TimePicker';
import type {
  Appointment,
  AppointmentStatus,
  AssignableMr,
  CreateAppointmentPayload,
} from '@/services/appointments.service';
import {
  packAppointmentRemarks,
  unpackAppointmentRemarks,
  type AppointmentMeta,
} from '@/utils/fieldMeta';

interface DoctorOption {
  id: number;
  fullName: string;
  specialization?: string | null;
  city?: string | null;
}

interface AppointmentFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAppointmentPayload) => void;
  submitting?: boolean;
  canAssignMr: boolean;
  currentUserId?: number;
  doctors: DoctorOption[];
  mrs: AssignableMr[];
  initialDate?: string;
  initialTime?: string;
  editing?: Appointment | null;
}

export function AppointmentFormDialog({
  open,
  onClose,
  onSubmit,
  submitting,
  canAssignMr,
  currentUserId,
  doctors,
  mrs,
  initialDate = '',
  initialTime = '10:00',
  editing = null,
}: AppointmentFormDialogProps) {
  const [doctorId, setDoctorId] = useState('');
  const [mrId, setMrId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [purpose, setPurpose] = useState('');
  const [location, setLocation] = useState('');
  const [priority, setPriority] = useState<NonNullable<AppointmentMeta['priority']>>('MEDIUM');
  const [status, setStatus] = useState<AppointmentStatus>('PENDING');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const unpacked = unpackAppointmentRemarks(editing.remarks);
      setDoctorId(String(editing.doctorId));
      setMrId(String(editing.mrId));
      setDate(editing.date);
      setTime(editing.time);
      setPurpose(editing.purpose ?? '');
      setLocation(unpacked.meta.location ?? '');
      setPriority(unpacked.meta.priority ?? 'MEDIUM');
      setStatus(editing.status);
      setRemarks(unpacked.text);
      return;
    }
    setDoctorId('');
    setMrId(canAssignMr ? '' : String(currentUserId ?? ''));
    setDate(initialDate);
    setTime(initialTime);
    setPurpose('');
    setLocation('');
    setPriority('MEDIUM');
    setStatus('PENDING');
    setRemarks('');
  }, [open, editing, initialDate, initialTime, canAssignMr, currentUserId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      doctorId: Number(doctorId),
      mrId: canAssignMr ? (mrId ? Number(mrId) : undefined) : currentUserId,
      date,
      time,
      purpose: purpose.trim() || undefined,
      remarks: packAppointmentRemarks(remarks.trim(), {
        location: location.trim() || undefined,
        priority,
      }),
      status: status === 'PENDING' ? undefined : status,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Calendar}
      badge={editing ? 'Editing' : 'New Schedule'}
      title={editing ? 'Edit Appointment' : 'Schedule Appointment'}
      description={
        canAssignMr
          ? 'Assign doctor appointments to field representatives with date, time, and priority.'
          : 'Plan and schedule your upcoming doctor appointment.'
      }
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="appointment-form" loading={submitting}>
            {submitting ? 'Saving…' : editing ? 'Update Appointment' : 'Confirm Appointment'}
          </Button>
        </>
      }
    >
      <form id="appointment-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormSection
          title="Stakeholder Selection"
          subtitle="Choose doctor and assigned representative"
          icon={UserCheck}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchableSelect
              label="Doctor"
              required
              className="sm:col-span-2"
              value={doctorId}
              onChange={setDoctorId}
              options={doctors.map((d) => ({
                value: String(d.id),
                label: d.fullName,
                meta: [d.specialization, d.city].filter(Boolean).join(' · ') || undefined,
              }))}
            />

            {canAssignMr ? (
              <SearchableSelect
                label="Assign to MR"
                required
                className="sm:col-span-2"
                value={mrId}
                onChange={setMrId}
                options={mrs.map((m) => ({
                  value: String(m.id),
                  label: m.fullName,
                  meta: `${m.role} · ${m.email}`,
                }))}
              />
            ) : (
              <Input
                label="Assigned MR"
                className="sm:col-span-2"
                value="You (Current MR)"
                disabled
                readOnly
              />
            )}
          </div>
        </FormSection>

        <FormSection
          title="Date & Time Schedule"
          subtitle="Select date and timing for the visit"
          icon={Clock}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker label="Appointment Date" required value={date} onChange={setDate} />
            <TimePicker label="Appointment Time" required value={time} onChange={setTime} />
          </div>
        </FormSection>

        <FormSection
          title="Meeting Scope & Priority"
          subtitle="Specify meeting purpose, location, and urgency"
          icon={FileText}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Purpose"
              placeholder="e.g. Monthly Detailing / Sample Demo"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
            <Input
              label="Location / Clinic Branch"
              placeholder="e.g. City Hospital OPD Room 4"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />

            <Select
              label="Priority Level"
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
            >
              <option value="LOW">🟢 Low Priority</option>
              <option value="MEDIUM">🟡 Medium Priority</option>
              <option value="HIGH">🔴 High Priority</option>
            </Select>

            <Select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              disabled={editing?.status === 'COMPLETED' || !editing}
            >
              <option value="PENDING">Pending</option>
              {editing ? <option value="CANCELLED">Cancelled</option> : null}
              {editing?.status === 'COMPLETED' ? <option value="COMPLETED">Completed</option> : null}
            </Select>

            <Textarea
              label="Remarks / Internal Notes"
              placeholder="Add any specific guidelines or preparation notes…"
              className="sm:col-span-2"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}

