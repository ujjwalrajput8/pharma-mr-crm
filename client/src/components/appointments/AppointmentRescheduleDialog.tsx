import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { TimePicker } from '@/components/ui/TimePicker';
import type { Appointment } from '@/services/appointments.service';
import { formatDisplayDate, formatTime12 } from '@/utils/datetime';
import { packAppointmentRemarks, unpackAppointmentRemarks } from '@/utils/fieldMeta';

export interface ReschedulePayload {
  date: string;
  time: string;
  remarks?: string;
}

interface AppointmentRescheduleDialogProps {
  open: boolean;
  appointment: Appointment | null;
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: ReschedulePayload) => void;
}

export function AppointmentRescheduleDialog({
  open,
  appointment,
  submitting,
  onClose,
  onSubmit,
}: AppointmentRescheduleDialogProps) {
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!open || !appointment) return;
    setDate(appointment.date);
    setTime(appointment.time);
    setNote('');
  }, [open, appointment]);

  if (!appointment) return null;

  const current = appointment;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const existing = unpackAppointmentRemarks(current.remarks);
    const noteText = note.trim();
    const historyLine = `Rescheduled from ${formatDisplayDate(current.date)} ${formatTime12(current.time)} → ${formatDisplayDate(date)} ${formatTime12(time)}${noteText ? `. ${noteText}` : ''}`;
    const remarks = packAppointmentRemarks(
      [existing.text, historyLine].filter(Boolean).join('\n'),
      existing.meta,
    );

    onSubmit({ date, time, remarks });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Reschedule appointment"
      description={`${appointment.doctor?.fullName ?? 'Doctor'} · ${appointment.mr?.fullName ?? 'MR'}`}
      className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="reschedule-form" size="sm" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save new schedule'}
          </Button>
        </>
      }
    >
      <form id="reschedule-form" className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit}>
        <p className="sm:col-span-2 text-sm text-[var(--color-muted)]">
          Current:{' '}
          <span className="font-medium text-[var(--color-ink)]">
            {formatDisplayDate(appointment.date)} · {formatTime12(appointment.time)}
          </span>
          . Status will become <strong>RESCHEDULED</strong>.
        </p>
        <DatePicker label="New date" required value={date} onChange={setDate} />
        <TimePicker label="New time" required value={time} onChange={setTime} />
        <Textarea
          label="Reschedule note (optional)"
          className="sm:col-span-2"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for change…"
        />
      </form>
    </Modal>
  );
}
