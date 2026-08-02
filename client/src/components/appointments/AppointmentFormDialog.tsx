import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TimePicker } from '@/components/ui/TimePicker';
import type { Appointment, AppointmentStatus, CreateAppointmentPayload } from '@/services/appointments.service';
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

interface MrOption {
  id: number;
  fullName: string;
  email: string;
}

interface AppointmentFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateAppointmentPayload) => void;
  submitting?: boolean;
  isAdmin: boolean;
  currentUserId?: number;
  doctors: DoctorOption[];
  mrs: MrOption[];
  initialDate?: string;
  initialTime?: string;
  editing?: Appointment | null;
}

export function AppointmentFormDialog({
  open,
  onClose,
  onSubmit,
  submitting,
  isAdmin,
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
    setMrId(isAdmin ? '' : String(currentUserId ?? ''));
    setDate(initialDate);
    setTime(initialTime);
    setPurpose('');
    setLocation('');
    setPriority('MEDIUM');
    setStatus('PENDING');
    setRemarks('');
  }, [open, editing, initialDate, initialTime, isAdmin, currentUserId]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({
      doctorId: Number(doctorId),
      mrId: isAdmin ? (mrId ? Number(mrId) : undefined) : currentUserId,
      date,
      time,
      purpose: purpose.trim() || undefined,
      remarks: packAppointmentRemarks(remarks.trim(), { location: location.trim() || undefined, priority }),
      status: status === 'PENDING' ? undefined : status,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit Appointment' : 'Create Appointment'}
      description="Schedule a meeting only — visit logging happens on completion."
      className="max-w-3xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="appointment-form" disabled={submitting}>
            {submitting ? 'Saving…' : editing ? 'Update' : 'Save Appointment'}
          </Button>
        </>
      }
    >
      <form id="appointment-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
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

        {isAdmin ? (
          <SearchableSelect
            label="Medical Representative"
            required
            className="sm:col-span-2"
            value={mrId}
            onChange={setMrId}
            options={mrs.map((m) => ({ value: String(m.id), label: m.fullName, meta: m.email }))}
          />
        ) : (
          <Input
            label="MR"
            className="sm:col-span-2"
            value="You (auto-selected)"
            disabled
            readOnly
          />
        )}

        <DatePicker label="Appointment Date" required value={date} onChange={setDate} />
        <TimePicker label="Appointment Time" required value={time} onChange={setTime} />

        <Input label="Purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        <Input label="Location" value={location} onChange={(e) => setLocation(e.target.value)} />

        <Select
          label="Priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value as typeof priority)}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
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
          label="Remarks"
          className="sm:col-span-2"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </form>
    </Modal>
  );
}
