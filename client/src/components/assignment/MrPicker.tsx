import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search, UserX } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { FieldLabel } from '@/components/ui/FormKit';
import { fieldControlTriggerClass } from '@/components/ui/formStyles';
import { doctorsApi, type MrOption } from '@/services/doctors.service';
import { cn } from '@/utils/cn';

/**
 * Searchable MR picker for doctor assignment: photo, name, code, the reporting line
 * above the MR, area and how many doctors they already have. The doctor's current
 * MR is shown on top so a reassignment is never a surprise. Manager → own team only
 * (the server decides).
 */
export function MrPicker({
  label = 'Assigned MR',
  value,
  onChange,
  current,
  allowUnassign = false,
  required,
  disabled,
  error,
}: {
  label?: string;
  value: number | null;
  onChange: (mrId: number | null, option: MrOption | null) => void;
  /** The doctor's MR right now (shown as "Currently: …"). */
  current?: { id: number; fullName: string } | null;
  allowUnassign?: boolean;
  required?: boolean;
  disabled?: boolean;
  error?: string | null;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const options = useQuery({ queryKey: ['mr-options'], queryFn: () => doctorsApi.mrOptions(), staleTime: 60_000 });
  const selected = options.data?.find((o) => o.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = options.data ?? [];
    if (!q) return list;
    return list.filter((o) =>
      [o.fullName, o.employeeCode, o.area, o.team].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [options.data, query]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div ref={rootRef} className="relative" data-testid="mr-picker">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      {current !== undefined ? (
        <p className="mb-1.5 text-[11px] text-[var(--color-muted)]" data-testid="mr-current">
          Currently:{' '}
          <span className="font-semibold text-[var(--color-ink)]">{current ? current.fullName : 'Unassigned'}</span>
        </p>
      ) : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          fieldControlTriggerClass,
          'h-auto min-h-10 py-1.5',
          open && 'border-[var(--color-primary)]/70 ring-[3px] ring-[var(--color-primary)]/12',
          error && 'border-[var(--color-danger)]',
        )}
      >
        {selected ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={selected.fullName} userId={selected.id} photoUrl={selected.photoUrl} size="sm" />
            <span className="min-w-0 text-left">
              <span className="block truncate text-[13px] font-semibold text-[var(--color-ink)]">
                {selected.fullName}
                {selected.employeeCode ? <span className="ml-1.5 font-normal text-[var(--color-muted)]">{selected.employeeCode}</span> : null}
              </span>
              {selected.team ? <span className="block truncate text-[11px] text-[var(--color-muted)]">{selected.team}</span> : null}
            </span>
          </span>
        ) : (
          <span className="text-[13px] text-[var(--color-muted)]/70">{value === null && allowUnassign ? 'Unassigned' : 'Choose an MR…'}</span>
        )}
        <ChevronDown size={16} className="shrink-0 text-[var(--color-muted)]" />
      </button>
      {error ? <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">{error}</p> : null}

      {open ? (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg animate-fade-in">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
            <Search size={14} className="text-[var(--color-muted)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, code, area or manager"
              className="h-7 w-full bg-transparent text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/60"
            />
          </div>
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {allowUnassign ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === null}
                  onClick={() => {
                    onChange(null, null);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)]"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-bg)]">
                    <UserX size={14} />
                  </span>
                  No MR (unassigned)
                </button>
              </li>
            ) : null}
            {options.isLoading ? <li className="px-3 py-3 text-xs text-[var(--color-muted)]">Loading MRs…</li> : null}
            {!options.isLoading && filtered.length === 0 ? (
              <li className="px-3 py-3 text-xs text-[var(--color-muted)]">No MR matches “{query}”.</li>
            ) : null}
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={o.id === value}
                  onClick={() => {
                    onChange(o.id, o);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-subtle)]',
                    o.id === value && 'bg-[var(--color-primary-soft)]/50',
                  )}
                >
                  <Avatar name={o.fullName} userId={o.id} photoUrl={o.photoUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--color-ink)]">
                      <span className="truncate">{o.fullName}</span>
                      {o.employeeCode ? <span className="shrink-0 font-mono text-[10.5px] font-normal text-[var(--color-muted)]">{o.employeeCode}</span> : null}
                      {current?.id === o.id ? (
                        <span className="shrink-0 rounded-full bg-[var(--color-bg)] px-1.5 text-[10px] font-semibold text-[var(--color-muted)]">current</span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[11px] text-[var(--color-muted)]">
                      {[o.team, o.area].filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-[11px] tabular-nums text-[var(--color-muted)]">
                    {o.doctorCount} dr
                  </span>
                  {o.id === value ? <Check size={14} className="shrink-0 text-[var(--color-primary)]" /> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
