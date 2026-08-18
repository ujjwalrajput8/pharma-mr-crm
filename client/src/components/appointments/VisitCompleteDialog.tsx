import { CheckCircle2, MessageSquare, PackageCheck, Pill, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { FormSection, Modal } from '@/components/ui/Modal';
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
      icon={CheckCircle2}
      badge="Visit Logging"
      title="Complete Appointment & Log Visit"
      description="Capture detailed interaction notes, products discussed, and distribute physical samples with automated stock deduction."
      className="max-w-4xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="visit-complete-form" loading={submitting}>
            {submitting ? 'Saving Visit Record…' : 'Complete & Save Visit'}
          </Button>
        </>
      }
    >
      <form id="visit-complete-form" className="space-y-4" onSubmit={handleSubmit}>
        <FormSection
          title="Basic Visit Info & Timings"
          subtitle="Appointment context, visit date, check-in, and check-out"
          icon={CheckCircle2}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Appointment" value={appointment ? `#${appointment.id}` : ''} disabled readOnly />
            <Input label="Doctor" value={appointment?.doctor?.fullName ?? ''} disabled readOnly />
            <Input label="Assigned MR" value={appointment?.mr?.fullName ?? '—'} disabled readOnly />
            <Input
              label="Calculated Duration"
              value={duration != null ? `${duration} mins` : '—'}
              readOnly
              disabled
            />
            <DatePicker label="Visit Date" required value={visitDate} onChange={setVisitDate} />
            <TimePicker label="Scheduled Time" required value={visitTime} onChange={setVisitTime} />
            <TimePicker label="Check-in Time" required value={checkIn} onChange={setCheckIn} />
            <TimePicker label="Check-out Time" required value={checkOut} onChange={setCheckOut} />
          </div>
        </FormSection>

        <FormSection
          title="Meeting Interaction & Feedback"
          subtitle="Detailed doctor feedback, outcome, and follow-up timeline"
          icon={MessageSquare}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Textarea
              label="Discussion Summary"
              placeholder="Key topics discussed, new therapies presented..."
              className="sm:col-span-2"
              value={discussionNotes}
              onChange={(e) => setDiscussionNotes(e.target.value)}
            />
            <Textarea
              label="Doctor Feedback"
              placeholder="Doctor's response, patient feedback on molecules, competitor feedback..."
              className="sm:col-span-2"
              value={doctorFeedback}
              onChange={(e) => setDoctorFeedback(e.target.value)}
            />
            <Select label="Visit Outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">Select visit outcome</option>
              <option value="POSITIVE">🟢 Positive (High Prescription Intent)</option>
              <option value="NEUTRAL">🟡 Neutral (Agreed to evaluate)</option>
              <option value="FOLLOW_UP">🔵 Needs Follow-up Visit</option>
              <option value="NOT_INTERESTED">🔴 Not Interested</option>
            </Select>
            <DatePicker label="Next Follow-up Date" value={nextFollowUp} onChange={setNextFollowUp} />
            <Textarea
              label="General Remarks"
              placeholder="Additional internal notes..."
              className="sm:col-span-2"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </FormSection>

        <FormSection
          title="Products Discussed"
          subtitle="Select molecules and drugs detailed during this meeting"
          icon={Pill}
        >
          <div className="space-y-3">
            <div className="flex justify-end">
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
                <Plus size={14} /> Add Molecule / Drug
              </Button>
            </div>
            
            {products.map((row, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs sm:grid-cols-2 lg:grid-cols-12 items-center"
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
                  label="Rx Expected"
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
                  placeholder="Doctor remarks on product"
                  value={row.remarks}
                  onChange={(e) => {
                    const next = [...products];
                    next[index] = { ...row, remarks: e.target.value };
                    setProducts(next);
                  }}
                />
                <div className="flex items-end justify-center lg:col-span-1 pt-4">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setProducts((prev) => prev.filter((_, i) => i !== index))}
                    aria-label="Remove product row"
                    className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </FormSection>

        <FormSection
          title="Sample Distribution"
          subtitle="Distribute physical samples from your inventory (automatically updates stock)"
          icon={PackageCheck}
        >
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setSamples((prev) => [
                    ...prev,
                    { medicineId: '', batchNumber: '', quantity: 1, unit: 'strips', remarks: '' },
                  ])
                }
              >
                <Plus size={14} /> Add Sample Line
              </Button>
            </div>

            {samples.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-xs text-[var(--color-muted)]">
                No samples distributed on this visit. Click <strong>Add Sample Line</strong> if physical samples were handed over.
              </div>
            ) : (
              samples.map((row, index) => (
                <div
                  key={index}
                  className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 shadow-xs sm:grid-cols-2 lg:grid-cols-12 items-center"
                >
                  <SearchableSelect
                    label="Sample Medicine"
                    className="lg:col-span-4"
                    value={row.medicineId}
                    onChange={(value) => {
                      const next = [...samples];
                      next[index] = { ...row, medicineId: value };
                      setSamples(next);
                    }}
                    options={medicineOptions}
                  />
                  <Input
                    label="Batch #"
                    className="lg:col-span-2"
                    placeholder="Batch"
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
                    className="lg:col-span-1"
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
                    placeholder="Notes"
                    value={row.remarks}
                    onChange={(e) => {
                      const next = [...samples];
                      next[index] = { ...row, remarks: e.target.value };
                      setSamples(next);
                    }}
                  />
                  <div className="flex items-end justify-center lg:col-span-1 pt-4">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setSamples((prev) => prev.filter((_, i) => i !== index))}
                      className="text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}

