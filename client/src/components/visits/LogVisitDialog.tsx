import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck2,
  ClipboardPenLine,
  MapPin,
  MessageSquareText,
  Package,
  Pill,
  Plus,
  Stethoscope,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { getApiErrorDetails, getApiErrorMessage } from '@/api/client';
import { MrPicker } from '@/components/assignment/MrPicker';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Textarea } from '@/components/ui/Field';
import { ChoiceChips, FormFull, FormGrid } from '@/components/ui/FormKit';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { Modal, FormSection } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TimePicker } from '@/components/ui/TimePicker';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { appointmentsApi, type Appointment } from '@/services/appointments.service';
import { medicinesApi } from '@/services/medicines.service';
import {
  VISIT_PURPOSES,
  visitsApi,
  type InterestLevel,
  type Visit,
  type VisitProductInput,
  type VisitPurpose,
} from '@/services/visits.service';
import { addMinutesToHHmm, minutesBetween, toIsoDate } from '@/utils/datetime';
import { DoctorPicker, type PickedDoctor } from './DoctorPicker';
import { SamplePicker, type SampleLine } from './SamplePicker';

export type LogVisitMode =
  | { kind: 'direct'; doctor?: PickedDoctor; unlisted?: boolean; mrId?: number }
  | { kind: 'appointment'; appointment: Appointment }
  | { kind: 'correct'; visit: Visit };

const OUTCOMES = [
  { value: 'POSITIVE', label: 'Positive' },
  { value: 'NEUTRAL', label: 'Neutral' },
  { value: 'FOLLOW_UP', label: 'Follow-up' },
  { value: 'NOT_INTERESTED', label: 'Not interested' },
] as const;
const INTEREST: Array<{ value: InterestLevel; label: string }> = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
];

function shiftDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}
function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Wrapper: the form mounts only while open, so every open starts clean (new clientUuid). */
export function LogVisitDialog({
  mode,
  onClose,
  onSaved,
  onOpenVisit,
}: {
  mode: LogVisitMode | null;
  onClose: () => void;
  onSaved?: (visit: Visit | null) => void;
  /** "Open visit" on a duplicate. */
  onOpenVisit?: (visitId: number) => void;
}) {
  if (!mode) return null;
  return <LogVisitForm mode={mode} onClose={onClose} onSaved={onSaved} onOpenVisit={onOpenVisit} />;
}

/**
 * One visit form for every door: direct (doctor list, profile, Today, Visits page),
 * completing an appointment, and correcting a visit. The server applies the same
 * rules to all of them; the form only helps (date window, bag stock, inline errors).
 */
function LogVisitForm({
  mode,
  onClose,
  onSaved,
  onOpenVisit,
}: {
  mode: LogVisitMode;
  onClose: () => void;
  onSaved?: (visit: Visit | null) => void;
  onOpenVisit?: (visitId: number) => void;
}) {
  const { user, role } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isMr = role === 'MR';
  const today = toIsoDate(new Date());
  const minDate = shiftDays(today, isMr ? -2 : -30);
  const visit = mode.kind === 'correct' ? mode.visit : null;
  const appointment = mode.kind === 'appointment' ? mode.appointment : null;

  const [clientUuid] = useState(() => crypto.randomUUID());
  const [doctor, setDoctor] = useState<PickedDoctor | null>(() => {
    if (mode.kind === 'direct') return mode.doctor ?? null;
    if (appointment?.doctor) return { ...appointment.doctor };
    if (visit?.doctor) return visit.doctor;
    return null;
  });
  const [unlisted, setUnlisted] = useState(mode.kind === 'direct' ? Boolean(mode.unlisted) : Boolean(visit?.offList));
  const [mrId, setMrId] = useState<number | null>(() => {
    if (mode.kind === 'direct') return mode.mrId ?? (role === 'ADMIN' ? null : (user?.id ?? null));
    return appointment?.mrId ?? visit?.mrId ?? null;
  });
  const initialTime = appointment?.time ?? visit?.visitTime ?? nowHHmm();
  const [form, setForm] = useState({
    visitDate: appointment?.date && appointment.date <= today ? appointment.date : (visit?.visitDate ?? today),
    visitTime: initialTime,
    checkInTime: visit?.checkInTime ?? initialTime,
    checkOutTime: visit?.checkOutTime ?? addMinutesToHHmm(initialTime, 20),
    purpose: (visit?.purpose ?? (appointment ? 'DETAILING' : '')) as VisitPurpose | '',
    discussionNotes: visit?.discussionNotes ?? '',
    doctorFeedback: visit?.doctorFeedback ?? '',
    visitOutcome: visit?.visitOutcome ?? '',
    nextFollowUp: visit?.nextFollowUp ?? '',
    remarks: visit?.remarks ?? '',
    reason: '',
  });
  const [products, setProducts] = useState<VisitProductInput[]>(
    () =>
      visit?.products.map((p) => ({
        medicineId: p.id,
        interestLevel: (p.interestLevel as InterestLevel | null) ?? undefined,
        prescriptionExpected: p.prescriptionExpected,
      })) ?? [],
  );
  const [samples, setSamples] = useState<SampleLine[]>([]);
  const [touched, setTouched] = useState(false);
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setTouched(true);
    setForm((f) => ({ ...f, [key]: value }));
  };

  // D8: location if the phone gives it — never required, never blocks.
  useState(() => {
    if (mode.kind === 'correct' || !('geolocation' in navigator)) return null;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => undefined,
      { timeout: 4000, maximumAge: 300_000 },
    );
    return null;
  });

  const medicines = useQuery({ queryKey: ['medicines'], queryFn: () => medicinesApi.list(), staleTime: 300_000 });
  const medicineOptions = useMemo(
    () => (medicines.data ?? []).map((m) => ({ value: String(m.id), label: m.name, meta: m.category ?? undefined })),
    [medicines.data],
  );

  const errors = {
    doctor: !doctor ? 'Choose the doctor you met' : null,
    mr: mode.kind === 'direct' && !mrId ? 'Choose the MR who made the visit' : null,
    checkOut: form.checkInTime && form.checkOutTime && form.checkOutTime < form.checkInTime ? 'Check-out cannot be before check-in' : null,
    followUp: form.nextFollowUp && form.nextFollowUp < form.visitDate ? 'Follow-up cannot be before the visit' : null,
    remarks: form.purpose === 'OTHER' && form.remarks.trim().length < 3 ? 'Say what the visit was for' : null,
    reason: mode.kind === 'correct' && form.reason.trim().length < 5 ? 'Say why (at least 5 characters)' : null,
  };
  const invalid = Object.values(errors).some(Boolean);
  const duration = minutesBetween(form.checkInTime, form.checkOutTime);

  const save = useMutation({
    mutationFn: async (): Promise<Visit | null> => {
      const common = {
        visitDate: form.visitDate,
        visitTime: form.visitTime,
        checkInTime: form.checkInTime || undefined,
        checkOutTime: form.checkOutTime || undefined,
        purpose: form.purpose || undefined,
        discussionNotes: form.discussionNotes || undefined,
        doctorFeedback: form.doctorFeedback || undefined,
        visitOutcome: form.visitOutcome || undefined,
        nextFollowUp: form.nextFollowUp || undefined,
        remarks: form.remarks || undefined,
        products,
      };
      if (mode.kind === 'direct') {
        return visitsApi.create({
          ...common,
          doctorId: doctor!.id,
          ...(mrId && mrId !== user?.id ? { mrId } : {}),
          samples: samples.map(({ medicineId, quantity, batchId }) => ({ medicineId, quantity, batchId })),
          ...(location ?? {}),
          clientUuid,
        });
      }
      if (mode.kind === 'appointment') {
        await appointmentsApi.complete(mode.appointment.id, {
          ...common,
          distributions: samples.map(({ medicineId, quantity, batchId }) => ({ medicineId, quantity, batchId })),
          ...(location ?? {}),
          clientUuid,
        });
        return null;
      }
      // Correction: only what changed, plus the reason.
      const v = mode.visit;
      const diff: Record<string, unknown> = {};
      const pairs: Array<[keyof typeof form, unknown]> = [
        ['visitTime', v.visitTime], ['checkInTime', v.checkInTime], ['checkOutTime', v.checkOutTime],
        ['purpose', v.purpose], ['discussionNotes', v.discussionNotes], ['doctorFeedback', v.doctorFeedback],
        ['visitOutcome', v.visitOutcome], ['nextFollowUp', v.nextFollowUp], ['remarks', v.remarks], ['visitDate', v.visitDate],
      ];
      for (const [key, before] of pairs) {
        const now = form[key] === '' ? null : form[key];
        if (now !== (before ?? null)) diff[key] = now;
      }
      if (doctor && doctor.id !== v.doctorId) diff.doctorId = doctor.id;
      diff.products = products;
      return visitsApi.correct(v.id, { ...diff, reason: form.reason.trim() });
    },
    onSuccess: async (saved) => {
      await Promise.all(
        ['visits', 'appointments', 'my-day', 'my-stock', 'bag', 'distributions', 'dashboard', 'doctors'].map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast.success(
        mode.kind === 'correct' ? 'Visit corrected' : mode.kind === 'appointment' ? 'Appointment completed' : 'Visit logged',
        saved?.offList ? 'Unlisted doctor — your manager will review it.' : undefined,
      );
      onSaved?.(saved);
      onClose();
    },
    onError: (error) => {
      setDuplicateId(getApiErrorDetails<{ existingVisitId?: number }>(error)?.existingVisitId ?? null);
    },
  });
  const guard = useDiscardGuard(touched && !save.isPending, onClose);

  const title = mode.kind === 'appointment' ? 'Complete appointment' : mode.kind === 'correct' ? 'Correct visit' : 'Log visit';
  const submitLabel = mode.kind === 'appointment' ? 'Complete & save visit' : mode.kind === 'correct' ? 'Save correction' : 'Save visit';
  const canChangeDoctor = mode.kind === 'direct' || (mode.kind === 'correct' && mode.visit.can.changeDateOrDoctor);

  return (
    <Modal
      open
      title={title}
      description={
        mode.kind === 'appointment'
          ? `Appointment #${mode.appointment.id} · ${mode.appointment.date} ${mode.appointment.time}`
          : mode.kind === 'correct'
            ? 'Change what was wrong and say why — the old values stay in the history.'
            : 'No appointment needed. Samples come out of the MR’s bag.'
      }
      icon={mode.kind === 'correct' ? ClipboardPenLine : CalendarCheck2}
      onClose={guard.request}
      className="max-w-3xl"
      error={save.isError && !duplicateId ? getApiErrorMessage(save.error) : null}
      footer={
        <>
          <Button variant="secondary" onClick={guard.request} disabled={save.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              setTouched(true);
              if (!invalid) save.mutate();
            }}
            loading={save.isPending}
            disabled={save.isPending}
          >
            {submitLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-6" data-testid="log-visit-form">
        {duplicateId ? (
          <div
            role="alert"
            data-testid="duplicate-visit"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-4 py-3 text-[13px] font-medium text-[var(--color-warning)]"
          >
            <span className="flex items-center gap-2">
              <TriangleAlert size={15} className="shrink-0" />
              {getApiErrorMessage(save.error)}
            </span>
            {onOpenVisit ? (
              <Button size="sm" variant="soft" onClick={() => onOpenVisit(duplicateId)}>
                Open visit
              </Button>
            ) : null}
          </div>
        ) : null}

        {mode.kind === 'direct' && role !== 'MR' ? (
          <MrPicker
            label="Visit made by"
            value={mrId}
            onChange={(id) => {
              setMrId(id);
              setSamples([]);
            }}
            required
            error={touched ? errors.mr : null}
          />
        ) : null}

        {!doctor ? (
          <DoctorPicker
            mrId={mrId}
            onPick={(d, isUnlisted) => {
              setDoctor(d);
              setUnlisted(isUnlisted);
              setTouched(true);
            }}
            error={touched ? errors.doctor : null}
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-4 sm:flex-row sm:items-start" data-testid="doctor-card">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              <Stethoscope size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-[var(--color-ink)]">
                {doctor.fullName}
                {doctor.mslClass ? (
                  <span className="rounded-md bg-[var(--color-surface)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-muted)]">Class {doctor.mslClass}</span>
                ) : null}
              </p>
              <p className="text-[12px] text-[var(--color-muted)]">
                {[doctor.mslNo ? `MSL ${doctor.mslNo}` : null, doctor.specialization, doctor.area].filter(Boolean).join(' · ')}
              </p>
              {doctor.address ? (
                <p className="mt-1 flex items-start gap-1 text-[12px] text-[var(--color-muted)]">
                  <MapPin size={12} className="mt-0.5 shrink-0" />
                  {doctor.address}
                </p>
              ) : null}
              {unlisted ? (
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-warning-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-warning)]" data-testid="unlisted-chip">
                  <TriangleAlert size={12} /> Unlisted — not in this MR’s list; the manager reviews it
                </p>
              ) : doctor.assignedMr ? (
                <p className="mt-1 text-[11.5px] text-[var(--color-muted)]">Assigned: {doctor.assignedMr.fullName}</p>
              ) : null}
            </div>
            {canChangeDoctor ? (
              <Button variant="ghost" size="sm" onClick={() => setDoctor(null)}>
                Change doctor
              </Button>
            ) : null}
          </div>
        )}

        <FormSection title="Visit details" icon={CalendarCheck2}>
          <FormGrid>
            <DatePicker
              label="Visit date"
              required
              value={form.visitDate}
              onChange={(v) => set('visitDate', v)}
              min={minDate}
              max={today}
              disabled={mode.kind === 'correct' && !mode.visit.can.changeDateOrDoctor}
            />
            <TimePicker label="Visit time" required value={form.visitTime} onChange={(v) => set('visitTime', v)} />
            <TimePicker label="Check-in" value={form.checkInTime} onChange={(v) => set('checkInTime', v)} />
            <div>
              <TimePicker label="Check-out" value={form.checkOutTime} onChange={(v) => set('checkOutTime', v)} />
              <p className={errors.checkOut && touched ? 'mt-1.5 text-xs font-medium text-[var(--color-danger)]' : 'mt-1.5 text-[11px] text-[var(--color-muted)]'}>
                {errors.checkOut && touched ? errors.checkOut : duration ? `${duration} min with the doctor` : ' '}
              </p>
            </div>
            <FormFull>
              <ChoiceChips label="Purpose" options={VISIT_PURPOSES} value={form.purpose} onChange={(v) => set('purpose', v as VisitPurpose | '')} allowClear />
            </FormFull>
          </FormGrid>
          {isMr ? <p className="mt-2 text-[11px] text-[var(--color-muted)]">You can log today and the two days before. Older visits are logged by your manager.</p> : null}
        </FormSection>

        <FormSection title="Discussion" subtitle="Products detailed and what the doctor said" icon={MessageSquareText}>
          <div className="space-y-3">
            {products.map((p, index) => (
              <div key={`${p.medicineId}-${index}`} className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-border)] px-3 py-2.5" data-testid="product-line">
                <Pill size={14} className="text-[var(--color-muted)]" />
                <span className="min-w-[140px] flex-1 text-[13px] font-semibold text-[var(--color-ink)]">
                  {medicines.data?.find((m) => m.id === p.medicineId)?.name ?? `Medicine ${p.medicineId}`}
                </span>
                <ChoiceChips
                  size="sm"
                  options={INTEREST}
                  value={p.interestLevel ?? ''}
                  allowClear
                  onChange={(v) => setProducts((list) => list.map((x, i) => (i === index ? { ...x, interestLevel: (v || undefined) as InterestLevel | undefined } : x)))}
                />
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] text-[var(--color-ink)]">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--color-primary)]"
                    checked={Boolean(p.prescriptionExpected)}
                    onChange={(e) => setProducts((list) => list.map((x, i) => (i === index ? { ...x, prescriptionExpected: e.target.checked } : x)))}
                  />
                  Rx expected
                </label>
                <Button variant="ghost" size="icon-sm" aria-label="Remove product" onClick={() => setProducts((list) => list.filter((_, i) => i !== index))}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            <SearchableSelect
              label="Add a product discussed"
              value=""
              onChange={(value) => {
                if (!value) return;
                setTouched(true);
                setProducts((list) => (list.some((p) => p.medicineId === Number(value)) ? list : [...list, { medicineId: Number(value) }]));
              }}
              options={medicineOptions.filter((o) => !products.some((p) => String(p.medicineId) === o.value))}
              placeholder="Search products…"
            />
            <FormGrid>
              <Textarea label="Discussion notes" maxLength={5000} rows={3} value={form.discussionNotes} onChange={(e) => set('discussionNotes', e.target.value)} placeholder="What was detailed, questions asked…" />
              <Textarea label="Doctor feedback" maxLength={5000} rows={3} value={form.doctorFeedback} onChange={(e) => set('doctorFeedback', e.target.value)} placeholder="In the doctor’s words" />
            </FormGrid>
          </div>
        </FormSection>

        {mode.kind !== 'correct' ? (
          <FormSection title="Samples" subtitle="From the MR’s bag — earliest expiry is used first" icon={Package}>
            <SamplePicker mrId={mrId} self={mrId === user?.id} lines={samples} onChange={(lines) => { setTouched(true); setSamples(lines); }} />
          </FormSection>
        ) : (
          <p className="rounded-xl bg-[var(--color-surface-subtle)] px-4 py-3 text-[12px] text-[var(--color-muted)]">
            Samples are not changed here — a manager uses <span className="font-semibold text-[var(--color-ink)]">Sample correction</span> so the stock ledger stays right.
          </p>
        )}

        <FormSection title="Outcome & follow-up" icon={Plus}>
          <FormGrid>
            <FormFull>
              <ChoiceChips label="Outcome" options={[...OUTCOMES]} value={form.visitOutcome} onChange={(v) => set('visitOutcome', v)} allowClear />
            </FormFull>
            <div>
              <DatePicker label="Next follow-up" value={form.nextFollowUp} onChange={(v) => set('nextFollowUp', v)} min={form.visitDate} />
              {errors.followUp && touched ? <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">{errors.followUp}</p> : null}
            </div>
            <Textarea
              label="Remarks"
              required={form.purpose === 'OTHER'}
              maxLength={5000}
              rows={2}
              value={form.remarks}
              onChange={(e) => set('remarks', e.target.value)}
              error={touched ? errors.remarks : null}
              placeholder={form.purpose === 'OTHER' ? 'What was the visit for?' : 'Anything else worth noting'}
            />
          </FormGrid>
        </FormSection>

        {mode.kind === 'correct' ? (
          <FormSection title="Why the correction" icon={ClipboardPenLine}>
            <Input
              label="Reason"
              required
              maxLength={500}
              value={form.reason}
              onChange={(e) => set('reason', e.target.value)}
              error={touched ? errors.reason : null}
              placeholder="e.g. Wrong time entered — met at 4 pm, not 2 pm"
              hint="Kept in the visit's history with the old and new values."
            />
          </FormSection>
        ) : null}
      </div>
      {guard.dialog}
    </Modal>
  );
}
