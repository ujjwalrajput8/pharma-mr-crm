import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardPenLine, MapPin, Pill, Search, TriangleAlert, Warehouse, X } from 'lucide-react';
import { getApiErrorDetails, getApiErrorMessage } from '@/api/client';
import { MrPicker } from '@/components/assignment/MrPicker';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Textarea } from '@/components/ui/Field';
import { ChoiceChips, FieldLabel, FormGrid } from '@/components/ui/FormKit';
import { FormSection, Modal } from '@/components/ui/Modal';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { TimePicker } from '@/components/ui/TimePicker';
import { useToast } from '@/components/ui/Toast';
import { useDiscardGuard } from '@/hooks/useDiscardGuard';
import { medicinesApi } from '@/services/medicines.service';
import { storesApi, type MedicalStore, type StoreType } from '@/services/stores.service';
import {
  STORE_VISIT_PURPOSES,
  visitsApi,
  type StorePurpose,
  type Visit,
  type VisitProductInput,
} from '@/services/visits.service';
import { useAuth } from '@/store/AuthContext';
import { toIsoDate } from '@/utils/datetime';
import { cn } from '@/utils/cn';
import { VisitDetailsDialog } from './VisitDetailsDialog';

export type StoreCallMode = { kind: 'store'; type: StoreType } | { kind: 'store-correct'; visit: Visit };

const NOUN: Record<StoreType, string> = { CHEMIST: 'chemist', STOCKIST: 'stockist' };

function shiftDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
}
function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Wrapper: the form mounts only while open, so every open starts clean (new clientUuid). */
export function LogStoreCallDialog({ mode, onClose }: { mode: StoreCallMode | null; onClose: () => void }) {
  if (!mode) return null;
  return <StoreCallForm mode={mode} onClose={onClose} />;
}

/**
 * DCR chemist / stockist call (M2.2): who, when, why, products talked about and the
 * order value. Same server rules as a doctor visit (date window, one call per day,
 * never deleted); no samples. Correction keeps the old values in the history.
 */
function StoreCallForm({ mode, onClose }: { mode: StoreCallMode; onClose: () => void }) {
  const { user, role } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const visit = mode.kind === 'store-correct' ? mode.visit : null;
  const type: StoreType = mode.kind === 'store' ? mode.type : (visit?.store?.type ?? 'CHEMIST');
  const noun = NOUN[type];
  const isMr = role === 'MR';
  const today = toIsoDate(new Date());
  const minDate = shiftDays(today, isMr ? -2 : -30);

  const [clientUuid] = useState(() => crypto.randomUUID());
  const [mrId, setMrId] = useState<number | null>(() => (role === 'ADMIN' ? null : (user?.id ?? null)));
  const [store, setStore] = useState<Pick<MedicalStore, 'id' | 'name'> | null>(visit?.store ?? null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({
    visitDate: visit?.visitDate ?? today,
    visitTime: visit?.visitTime ?? nowHHmm(),
    purpose: (visit?.purpose ?? '') as StorePurpose | '',
    orderValue: visit?.orderValue != null ? String(visit.orderValue) : '',
    discussionNotes: visit?.discussionNotes ?? '',
    remarks: visit?.remarks ?? '',
    reason: '',
  });
  const [products, setProducts] = useState<VisitProductInput[]>(() => visit?.products.map((p) => ({ medicineId: p.id })) ?? []);
  const [touched, setTouched] = useState(false);
  const [duplicateId, setDuplicateId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setTouched(true);
    setForm((f) => ({ ...f, [key]: value }));
  };

  const stores = useQuery({ queryKey: ['stores', type], queryFn: () => storesApi.list({ type }), enabled: !visit });
  const mine = useQuery({ queryKey: ['my-stores'], queryFn: () => storesApi.mine(), enabled: !visit && isMr });
  const medicines = useQuery({ queryKey: ['medicines'], queryFn: () => medicinesApi.list(), staleTime: 300_000 });
  const medicineOptions = useMemo(
    () => (medicines.data ?? []).map((m) => ({ value: String(m.id), label: m.name, meta: m.category ?? undefined })),
    [medicines.data],
  );
  const medicineName = (id: number) => medicines.data?.find((m) => m.id === id)?.name ?? `Product ${id}`;

  const mineIds = useMemo(() => new Set((mine.data ?? []).map((s) => s.id)), [mine.data]);
  const choices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (stores.data ?? []).filter((s) => s.status === 'ACTIVE' && (!q || [s.name, s.ownerName, s.city].some((v) => v?.toLowerCase().includes(q))));
    return [...list.filter((s) => mineIds.has(s.id)), ...list.filter((s) => !mineIds.has(s.id))].slice(0, 60);
  }, [stores.data, mineIds, search]);

  const order = form.orderValue.trim() === '' ? null : Number(form.orderValue);
  const errors = {
    store: !store ? `Choose the ${noun} you called on` : null,
    mr: mode.kind === 'store' && !isMr && !mrId ? 'Choose the MR who made the call' : null,
    order: order != null && (!Number.isFinite(order) || order < 0) ? 'Order value must be 0 or more' : null,
    remarks: form.purpose === 'OTHER' && form.remarks.trim().length < 3 ? 'Say what the call was for' : null,
    reason: visit && form.reason.trim().length < 5 ? 'Say why (at least 5 characters)' : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  const save = useMutation({
    mutationFn: async (): Promise<Visit> => {
      if (!visit) {
        return visitsApi.storeCall({
          storeId: store!.id,
          ...(mrId && mrId !== user?.id ? { mrId } : {}),
          visitDate: form.visitDate,
          visitTime: form.visitTime,
          purpose: form.purpose || undefined,
          discussionNotes: form.discussionNotes || undefined,
          remarks: form.remarks || undefined,
          ...(order != null ? { orderValue: order } : {}),
          products,
          clientUuid,
        });
      }
      const diff: Record<string, unknown> = {};
      const pairs: Array<[keyof typeof form, unknown]> = [
        ['visitTime', visit.visitTime], ['purpose', visit.purpose], ['discussionNotes', visit.discussionNotes],
        ['remarks', visit.remarks], ['visitDate', visit.visitDate],
      ];
      for (const [key, before] of pairs) {
        const now = form[key] === '' ? null : form[key];
        if (now !== (before ?? null)) diff[key] = now;
      }
      if (order !== visit.orderValue) diff.orderValue = order;
      diff.products = products;
      return visitsApi.correct(visit.id, { ...diff, reason: form.reason.trim() });
    },
    onSuccess: async () => {
      await Promise.all(['visits', 'my-day', 'dashboard', 'reports'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      toast.success(visit ? 'Call corrected' : `${noun === 'chemist' ? 'Chemist' : 'Stockist'} call logged`);
      onClose();
    },
    onError: (error) => setDuplicateId(getApiErrorDetails<{ existingVisitId?: number }>(error)?.existingVisitId ?? null),
  });
  const guard = useDiscardGuard(touched && !save.isPending, onClose);
  const Icon = type === 'STOCKIST' ? Warehouse : Pill;

  return (
    <Modal
      open
      title={visit ? 'Correct call' : `Log ${noun} call`}
      description={visit ? 'Change what was wrong and say why — the old values stay in the history.' : `DCR · ${noun === 'chemist' ? 'Chemist' : 'Stockist'} visit. No samples on this call.`}
      icon={visit ? ClipboardPenLine : Icon}
      onClose={guard.request}
      className="max-w-2xl"
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
            {visit ? 'Save correction' : 'Save call'}
          </Button>
        </>
      }
    >
      <div className="space-y-6" data-testid="store-call-form">
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
            <Button size="sm" variant="soft" onClick={() => setViewingId(duplicateId)}>
              Open visit
            </Button>
          </div>
        ) : null}

        {mode.kind === 'store' && !isMr ? (
          <MrPicker label="Call made by" value={mrId} onChange={(id) => setMrId(id)} required error={touched ? errors.mr : null} />
        ) : null}

        {store ? (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-4" data-testid="store-card">
            <span className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-[var(--color-ink)]">{store.name}</span>
                <span className="text-xs text-[var(--color-muted)]">{noun === 'chemist' ? 'Chemist' : 'Stockist'}</span>
              </span>
            </span>
            {!visit ? (
              <Button variant="ghost" size="sm" onClick={() => setStore(null)}>
                Change {noun}
              </Button>
            ) : null}
          </div>
        ) : (
          <div data-testid="store-picker">
            <FieldLabel required>{noun === 'chemist' ? 'Chemist' : 'Stockist'}</FieldLabel>
            <div className={cn('overflow-hidden rounded-xl border border-[var(--color-border)]', touched && errors.store && 'border-[var(--color-danger)]')}>
              <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
                <Search size={14} className="text-[var(--color-muted)]" />
                <input
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={`Search ${noun}s by name, owner or city`}
                  aria-label={`Search ${noun}s`}
                  className="h-8 w-full bg-transparent text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/60"
                />
              </div>
              <ul role="listbox" aria-label={`${noun}s`} className="max-h-[min(20rem,40vh)] overflow-y-auto py-1">
                {stores.isLoading ? <li className="px-3 py-4 text-xs text-[var(--color-muted)]">Loading…</li> : null}
                {!stores.isLoading && choices.length === 0 ? (
                  <li className="px-3 py-4 text-xs text-[var(--color-muted)]">{search ? `No ${noun} matches “${search}”.` : `No ${noun}s yet.`}</li>
                ) : null}
                {choices.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      data-testid="store-option"
                      onClick={() => {
                        setTouched(true);
                        setStore(s);
                      }}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-surface-subtle)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-semibold text-[var(--color-ink)]">{s.name}</span>
                        <span className="flex items-center gap-1 text-[11.5px] text-[var(--color-muted)]">
                          {s.city ? <MapPin size={11} /> : null}
                          {[s.city, s.ownerName].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                      {mineIds.has(s.id) ? (
                        <span className="shrink-0 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-primary)]">In your list</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            {touched && errors.store ? <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">{errors.store}</p> : null}
          </div>
        )}

        <FormSection title="Call details" icon={ClipboardPenLine}>
          <FormGrid>
            <DatePicker
              label="Call date"
              required
              value={form.visitDate}
              min={minDate}
              max={today}
              disabled={Boolean(visit) && isMr}
              onChange={(v) => set('visitDate', v)}
            />
            <TimePicker label="Call time" required value={form.visitTime} onChange={(v) => set('visitTime', v)} />
          </FormGrid>
          <ChoiceChips
            label="Purpose"
            options={STORE_VISIT_PURPOSES}
            value={form.purpose}
            onChange={(v) => set('purpose', v as StorePurpose | '')}
            allowClear
          />
          <FormGrid>
            <Input
              label="Order value (₹)"
              inputMode="decimal"
              placeholder="0"
              value={form.orderValue}
              onChange={(e) => set('orderValue', e.target.value)}
              error={touched ? errors.order : null}
              hint="Order booked on this call, if any"
            />
            <div>
              <SearchableSelect
                label="Products discussed"
                value=""
                options={medicineOptions.filter((o) => !products.some((p) => String(p.medicineId) === o.value))}
                placeholder="Add a product…"
                onChange={(value) => {
                  if (!value) return;
                  setTouched(true);
                  setProducts((list) => [...list, { medicineId: Number(value) }]);
                }}
              />
              {products.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {products.map((p) => (
                    <li key={p.medicineId} className="flex items-center gap-1 rounded-full bg-[var(--color-bg)] py-0.5 pr-1 pl-2.5 text-xs text-[var(--color-ink)]">
                      {medicineName(p.medicineId)}
                      <button
                        type="button"
                        aria-label={`Remove ${medicineName(p.medicineId)}`}
                        onClick={() => setProducts((list) => list.filter((x) => x.medicineId !== p.medicineId))}
                        className="rounded-full p-0.5 hover:bg-[var(--color-surface-subtle)]"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </FormGrid>
          <Textarea label="Notes" rows={3} maxLength={5000} value={form.discussionNotes} onChange={(e) => set('discussionNotes', e.target.value)} placeholder="Stock seen, what was ordered, what the owner asked for…" />
          <Textarea label="Remarks" rows={2} maxLength={5000} value={form.remarks} onChange={(e) => set('remarks', e.target.value)} error={touched ? errors.remarks : null} />
        </FormSection>

        {visit ? (
          <Textarea
            label="Reason"
            required
            rows={2}
            maxLength={500}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            error={touched ? errors.reason : null}
            placeholder="e.g. Wrong order value entered"
            hint="Kept in the call's history with the old and new values."
          />
        ) : null}
      </div>
      {guard.dialog}
      <VisitDetailsDialog visitId={viewingId} onClose={() => setViewingId(null)} />
    </Modal>
  );
}
