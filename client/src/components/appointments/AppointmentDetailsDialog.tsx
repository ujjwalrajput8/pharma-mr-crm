import type { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui/Page';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { Appointment } from '@/services/appointments.service';
import { formatDisplayDate, formatTime12, shortId } from '@/utils/datetime';
import { unpackAppointmentRemarks } from '@/utils/fieldMeta';

interface AppointmentDetailsDialogProps {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  onComplete?: () => void;
  onCancel?: () => void;
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-[var(--color-border)] py-2 text-sm last:border-0">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="col-span-2 font-medium text-[var(--color-ink)]">{value || '—'}</dd>
    </div>
  );
}

export function AppointmentDetailsDialog({
  open,
  appointment,
  onClose,
  onComplete,
  onCancel,
}: AppointmentDetailsDialogProps) {
  if (!appointment) return null;
  const { text, meta } = unpackAppointmentRemarks(appointment.remarks);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Appointment Details"
      description="Scheduled meeting information"
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {appointment.status === 'PENDING' && onCancel ? (
            <Button variant="danger" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {appointment.status === 'PENDING' && onComplete ? (
            <Button onClick={onComplete}>Complete + Visit</Button>
          ) : null}
        </>
      }
    >
      <Card className="border-0 p-1 shadow-none">
        <dl>
          <Row label="Appointment No." value={`#${shortId(appointment.id)}`} />
          <Row label="Doctor" value={appointment.doctor?.fullName} />
          <Row label="MR" value={appointment.mr?.fullName} />
          <Row label="Date" value={formatDisplayDate(appointment.date)} />
          <Row label="Time" value={formatTime12(appointment.time)} />
          <Row label="Purpose" value={appointment.purpose} />
          <Row
            label="Status"
            value={
              <Badge
                tone={
                  appointment.status === 'COMPLETED'
                    ? 'success'
                    : appointment.status === 'CANCELLED'
                      ? 'danger'
                      : 'primary'
                }
              >
                {appointment.status}
              </Badge>
            }
          />
          <Row label="Location" value={meta.location} />
          <Row label="Priority" value={meta.priority} />
          <Row label="Remarks" value={text} />
        </dl>
      </Card>
    </Modal>
  );
}
