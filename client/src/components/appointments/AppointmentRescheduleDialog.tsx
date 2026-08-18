import { useEffect, useState, type FormEvent } from 'react';
import { CalendarSync, Clock } from 'lucide-react';
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
      icon={CalendarSync}
      badge="Reschedule"
      title="Reschedule Appointment"
      description={`Doctor: ${appointment.doctor?.fullName ?? 'Doctor'} · Representative: ${appointment.mr?.fullName ?? 'MR'}`}
      className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="reschedule-form" loading={submitting}>
            {submitting ? 'Updating…' : 'Save New Schedule'}
          </Button>
        </>
      }
    >
      <form id="reschedule-form" className="space-y-4" onSubmit={handleSubmit}>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <Clock size={14} className="text-amber-600 dark:text-amber-400" />
            <span>Current Scheduled Time</span>
          </div>
          <p className="mt-1 text-xs">
            {formatDisplayDate(appointment.date)} at {formatTime12(appointment.time)}
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]" />
            New Appointment Timings
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker label="New Date" required value={date} onChange={setDate} />
            <TimePicker label="New Time" required value={time} onChange={setTime} />
          </div>
          <Textarea
            label="Reason for Rescheduling"
            optional
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Doctor in emergency OT, requested afternoon slot..."
          />
        </div>
      </form>
    </Modal>
  );
}

