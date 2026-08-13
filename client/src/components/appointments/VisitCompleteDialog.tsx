import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TimePicker } from '@/components/ui/TimePicker';
import type { Appointment, CompleteAppointmentPayload } from '@/services/appointments.service';
import type { Medicine } from '@/services/medicines.service';
import { addMinutesToHHmm, minutesBetween } from '@/utils/datetime';
import { packProductNotes } from '@/utils/fieldMeta';

interface ProductRow {
  medicineId: string;
  remarks: string;
  interestLevel: string;
  prescriptionExpected: boolean;
}

interface SampleRow {
  medicineId: string;
  batchNumber: string;
  quantity: number;
  unit: string;
  remarks: string;
}

interface VisitCompleteDialogProps {
  open: boolean;
  appointment: Appointment | null;
  medicines: Medicine[];
  submitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: CompleteAppointmentPayload) => void;
}

export function VisitCompleteDialog({
  open,
  appointment,
  medicines,
  submitting,
  onClose,
  onSubmit,
}: VisitCompleteDialogProps) {
  const [visitDate, setVisitDate] = useState('');
  const [visitTime, setVisitTime] = useState('10:00');
  const [checkIn, setCheckIn] = useState('10:00');
  const [checkOut, setCheckOut] = useState('10:30');
  const [discussionNotes, setDiscussionNotes] = useState('');
  const [doctorFeedback, setDoctorFeedback] = useState('');
  const [outcome, setOutcome] = useState('');
  const [nextFollowUp, setNextFollowUp] = useState('');
  const [remarks, setRemarks] = useState('');
  const [products, setProducts] = useState<ProductRow[]>([
    { medicineId: '', remarks: '', interestLevel: 'MEDIUM', prescriptionExpected: false },
  ]);
  const [samples, setSamples] = useState<SampleRow[]>([]);

  useEffect(() => {
    if (!open || !appointment) return;
    setVisitDate(appointment.date);
    setVisitTime(appointment.time);
    setCheckIn(appointment.time);
    setCheckOut(addMinutesToHHmm(appointment.time, 30));
    setDiscussionNotes('');
    setDoctorFeedback('');
    setOutcome('');
    setNextFollowUp('');
    setRemarks('');
    setProducts([{ medicineId: '', remarks: '', interestLevel: 'MEDIUM', prescriptionExpected: false }]);
    setSamples([]);
  }, [open, appointment]);

  const duration = useMemo(() => minutesBetween(checkIn, checkOut), [checkIn, checkOut]);

  const medicineOptions = medicines.map((m) => ({
    value: String(m.id),
    label: m.name,
    meta: m.stock ? `Stock: ${m.stock.available}` : undefined,
  }));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!appointment) return;

    const productPayload = products
      .filter((row) => row.medicineId)
      .map((row) => ({
        medicineId: Number(row.medicineId),
        notes: packProductNotes({
          remarks: row.remarks,
          interestLevel: row.interestLevel,
          prescriptionExpected: row.prescriptionExpected,
        }),
      }));

    onSubmit({
      visitDate,
      visitTime: checkIn || visitTime,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      meetingDurationMin: duration ?? undefined,
      discussionNotes: discussionNotes.trim() || undefined,
      doctorFeedback: doctorFeedback.trim() || undefined,
      visitOutcome: outcome.trim() || undefined,
      nextFollowUp: nextFollowUp || undefined,
      remarks: remarks.trim() || undefined,
      medicineIds: productPayload.map((p) => p.medicineId),
      products: productPayload,
      distributions: samples
        .filter((row) => row.medicineId && row.quantity > 0)
        .map((row) => ({
          medicineId: Number(row.medicineId),
          quantity: row.quantity,
          batchNumber: row.batchNumber || undefined,
          unit: row.unit || undefined,
          remarks: [row.unit ? `Unit: ${row.unit}` : null, row.remarks || null]
            .filter(Boolean)
            .join(' · ') || undefined,
        })),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Complete Appointment & Log Visit"
      description="Structured visit capture. Sample lines reduce stock automatically on save."
      className="max-w-4xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="visit-complete-form" disabled={submitting}>
            {submitting ? 'Saving…' : 'Complete & Save Visit'}
          </Button>
        </>
      }
    >
      <form id="visit-complete-form" className="space-y-6" onSubmit={handleSubmit}>
        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Section 1 · Basic Information
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Appointment" value={appointment ? `#${appointment.id}` : ''} disabled readOnly />
            <Input label="Doctor" value={appointment?.doctor?.fullName ?? ''} disabled readOnly />
            <Input label="MR" value={appointment?.mr?.fullName ?? '—'} disabled readOnly />
            <DatePicker label="Visit Date" required value={visitDate} onChange={setVisitDate} />
            <TimePicker label="Visit Time" required value={visitTime} onChange={setVisitTime} />
            <TimePicker label="Check-in Time" required value={checkIn} onChange={setCheckIn} />
            <TimePicker label="Check-out Time" required value={checkOut} onChange={setCheckOut} />
            <Input
              label="Meeting Duration (minutes)"
              value={duration ?? ''}
              readOnly
              disabled
            />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
            Section 2 · Meeting Details
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Textarea
              label="Discussion Summary"
              className="sm:col-span-2"
              value={discussionNotes}
              onChange={(e) => setDiscussionNotes(e.target.value)}
            />
            <Textarea
              label="Doctor Feedback"
              className="sm:col-span-2"
              value={doctorFeedback}
              onChange={(e) => setDoctorFeedback(e.target.value)}
            />
            <Select label="Visit Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">Select outcome</option>
              <option value="POSITIVE">Positive</option>
              <option value="NEUTRAL">Neutral</option>
              <option value="FOLLOW_UP">Needs Follow-up</option>
              <option value="NOT_INTERESTED">Not Interested</option>
            </Select>
            <DatePicker label="Next Follow-up Date" value={nextFollowUp} onChange={setNextFollowUp} />
            <Textarea
              label="Remarks"
              className="sm:col-span-2"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Section 3 · Products Discussed
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setProducts((prev) => [
                  ...prev,
                  { medicineId: '', remarks: '', interestLevel: 'MEDIUM', prescriptionExpected: false },
                ])
              }
            >
              <Plus size={14} /> Add More
            </Button>
          </div>
          <div className="space-y-3">
            {products.map((row, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-2xl border border-[var(--color-border)] p-3 sm:grid-cols-2 lg:grid-cols-12"
              >
                <SearchableSelect
                  label="Medicine"
                  className="lg:col-span-4"
                  value={row.medicineId}
                  onChange={(value) => {
                    const next = [...products];
                    next[index] = { ...row, medicineId: value };
                    setProducts(next);
                  }}
                  options={medicineOptions}
                />
                <Select
                  label="Interest Level"
                  className="lg:col-span-2"
                  value={row.interestLevel}
                  onChange={(e) => {
                    const next = [...products];
                    next[index] = { ...row, interestLevel: e.target.value };
                    setProducts(next);
                  }}
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </Select>
                <Select
                  label="Prescription Expected"
                  className="lg:col-span-2"
                  value={row.prescriptionExpected ? 'yes' : 'no'}
                  onChange={(e) => {
                    const next = [...products];
                    next[index] = { ...row, prescriptionExpected: e.target.value === 'yes' };
                    setProducts(next);
                  }}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </Select>
                <Input
                  label="Remarks"
                  className="lg:col-span-3"
                  value={row.remarks}
                  onChange={(e) => {
                    const next = [...products];
                    next[index] = { ...row, remarks: e.target.value };
                    setProducts(next);
                  }}
                />
                <div className="flex items-end lg:col-span-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setProducts((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove product row"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted)]">
              Section 4 · Sample Distribution
            </h3>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setSamples((prev) => [
                  ...prev,
                  { medicineId: '', batchNumber: '', quantity: 1, unit: 'pcs', remarks: '' },
                ])
              }
            >
              <Plus size={14} /> Add More
            </Button>
          </div>
          <div className="space-y-3">
            {samples.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--color-border)] px-4 py-6 text-center text-sm text-[var(--color-muted)]">
                Optional — add sample lines to decrement stock on save.
              </p>
            ) : (
              samples.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-2xl border border-[var(--color-border)] p-3 sm:grid-cols-2 lg:grid-cols-12"
                >
                  <SearchableSelect
                    label="Medicine"
                    className="lg:col-span-3"
                    value={row.medicineId}
                    onChange={(value) => {
                      const next = [...samples];
                      next[index] = { ...row, medicineId: value };
                      setSamples(next);
                    }}
                    options={medicineOptions}
                  />
                  <Input
                    label="Batch"
                    className="lg:col-span-2"
                    value={row.batchNumber}
                    onChange={(e) => {
                      const next = [...samples];
                      next[index] = { ...row, batchNumber: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <Input
                    label="Quantity"
                    type="number"
                    min={1}
                    className="lg:col-span-2"
                    value={row.quantity}
                    onChange={(e) => {
                      const next = [...samples];
                      next[index] = { ...row, quantity: Number(e.target.value) };
                      setSamples(next);
                    }}
                  />
                  <Input
                    label="Unit"
                    className="lg:col-span-2"
                    value={row.unit}
                    onChange={(e) => {
                      const next = [...samples];
                      next[index] = { ...row, unit: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <Input
                    label="Remarks"
                    className="lg:col-span-2"
                    value={row.remarks}
                    onChange={(e) => {
                      const next = [...samples];
                      next[index] = { ...row, remarks: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <div className="flex items-end lg:col-span-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setSamples((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </form>
    </Modal>
  );
}
