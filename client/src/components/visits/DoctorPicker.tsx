import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Search, Stethoscope } from 'lucide-react';
import { FieldLabel } from '@/components/ui/FormKit';
import { doctorsApi, type Doctor } from '@/services/doctors.service';
import { visitsApi } from '@/services/visits.service';
import { cn } from '@/utils/cn';

/** What the visit form needs to know about the chosen doctor. */
export interface PickedDoctor {
  id: number;
  fullName: string;
  mslNo?: string | null;
  mslClass?: string | null;
  specialization?: string | null;
  area?: string | null;
  address?: string | null;
  assignedMr?: { id: number; fullName: string } | null;
}

function fromDoctor(d: Doctor): PickedDoctor {
  return {
    id: d.id,
    fullName: d.fullName,
    mslNo: d.mslNo,
    mslClass: d.mslClass,
    specialization: d.specialization,
    area: d.area,
    address: d.address,
    assignedMr: d.assignedMrs[0] ? { id: d.assignedMrs[0].id, fullName: d.assignedMrs[0].fullName } : null,
  };
}

/**
 * Doctor choice for a visit. "Your doctors" first (the MR's list); typing 2+ letters
 * also searches every doctor of the company — those are marked Unlisted and the
 * visit goes to the manager's review (the doctor is never assigned automatically).
 */
export function DoctorPicker({
  mrId,
  onPick,
  error,
}: {
  /** Whose list counts as "theirs" — the MR the visit is for. */
  mrId: number | null;
  onPick: (doctor: PickedDoctor, unlisted: boolean) => void;
  error?: string | null;
}) {
  const [query, setQuery] = useState('');
  const doctors = useQuery({ queryKey: ['doctors'], queryFn: () => doctorsApi.list(), staleTime: 60_000 });
  const term = query.trim().toLowerCase();
  const mine = useMemo(() => {
    const list = (doctors.data ?? []).filter((d) => mrId != null && d.assignedMrs.some((m) => m.id === mrId));
    if (!term) return list.slice(0, 30);
    return list.filter((d) => [d.fullName, d.mslNo, d.area, d.specialization].some((v) => v?.toLowerCase().includes(term))).slice(0, 30);
  }, [doctors.data, mrId, term]);
  const others = useQuery({
    queryKey: ['doctor-lookup', term],
    queryFn: () => visitsApi.lookupDoctors(term),
    enabled: term.length >= 2,
    staleTime: 30_000,
  });
  const mineIds = new Set(mine.map((d) => d.id));
  const unlisted = (others.data ?? []).filter((d) => !mineIds.has(d.id) && d.assignedMr?.id !== mrId);

  const row = (d: PickedDoctor, isUnlisted: boolean) => (
    <li key={`${isUnlisted ? 'u' : 'm'}-${d.id}`}>
      <button
        type="button"
        onClick={() => onPick(d, isUnlisted)}
        data-testid="doctor-option"
        className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-subtle)]"
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Stethoscope size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[var(--color-ink)]">
            {d.fullName}
            {d.mslClass ? <span className="rounded-md bg-[var(--color-bg)] px-1.5 text-[10px] font-bold text-[var(--color-muted)]">{d.mslClass}</span> : null}
            {isUnlisted ? (
              <span className="rounded-full bg-[var(--color-warning-soft)] px-2 text-[10px] font-semibold text-[var(--color-warning)]">Unlisted</span>
            ) : null}
          </span>
          <span className="block text-[11.5px] text-[var(--color-muted)]">
            {[d.mslNo ? `MSL ${d.mslNo}` : null, d.specialization, d.area].filter(Boolean).join(' · ')}
          </span>
          {d.address ? (
            <span className="mt-0.5 flex items-start gap-1 text-[11px] text-[var(--color-muted)]/90">
              <MapPin size={11} className="mt-0.5 shrink-0" />
              <span className="line-clamp-1">{d.address}</span>
            </span>
          ) : null}
          {isUnlisted && d.assignedMr ? (
            <span className="block text-[11px] text-[var(--color-muted)]">With {d.assignedMr.fullName}</span>
          ) : null}
        </span>
      </button>
    </li>
  );

  return (
    <div data-testid="doctor-picker">
      <FieldLabel required>Doctor</FieldLabel>
      <div
        className={cn(
          'flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/70 px-3.5 focus-within:border-[var(--color-primary)]/70 focus-within:ring-[3px] focus-within:ring-[var(--color-primary)]/12',
          error && 'border-[var(--color-danger)]',
        )}
      >
        <Search size={15} className="shrink-0 text-[var(--color-muted)]" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, MSL no., area — type 2 letters to search all doctors"
          className="h-full w-full bg-transparent text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/60"
          aria-label="Search doctors"
        />
      </div>
      {error ? <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">{error}</p> : null}
      <div className="mt-2 max-h-[46vh] overflow-y-auto rounded-xl border border-[var(--color-border)]">
        <p className="sticky top-0 bg-[var(--color-surface)] px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase">
          Your doctors
        </p>
        <ul className="px-1 pb-1">
          {doctors.isLoading ? <li className="px-3 py-2 text-xs text-[var(--color-muted)]">Loading…</li> : null}
          {!doctors.isLoading && mine.length === 0 ? (
            <li className="px-3 py-2 text-xs text-[var(--color-muted)]">{term ? 'None of your doctors match.' : 'No doctors assigned yet.'}</li>
          ) : null}
          {mine.map((d) => row(fromDoctor(d), false))}
        </ul>
        {term.length >= 2 ? (
          <>
            <p className="sticky top-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.08em] text-[var(--color-muted)] uppercase">
              All doctors · not in the list (manager reviews)
            </p>
            <ul className="px-1 pb-1">
              {others.isLoading ? <li className="px-3 py-2 text-xs text-[var(--color-muted)]">Searching…</li> : null}
              {!others.isLoading && unlisted.length === 0 ? <li className="px-3 py-2 text-xs text-[var(--color-muted)]">No other doctor matches.</li> : null}
              {unlisted.map((d) => row(d, true))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}
