import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Search, UserX } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { FieldLabel } from '@/components/ui/FormKit';
import { fieldControlTriggerClass } from '@/components/ui/formStyles';
import { useFloatingPanel } from '@/hooks/useFloatingPanel';
import { doctorsApi, type MrOption } from '@/services/doctors.service';
import { cn } from '@/utils/cn';

/**
 * Searchable MR picker for doctor assignment: photo, name, code, the reporting line
 * above the MR, area and how many doctors they already have. The doctor's current
 * MR is shown on top so a reassignment is never a surprise. Manager → own team only
 * (the server decides).
 *
 * `variant="inline"` keeps the list open inside the dialog (assignment dialogs);
 * `popover` (default) is a compact dropdown for long forms.
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
  variant = 'popover',
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
  variant?: 'popover' | 'inline';
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const options = useQuery({ queryKey: ['mr-options'], queryFn: () => doctorsApi.mrOptions(), staleTime: 60_000 });
  const selected = options.data?.find((o) => o.id === value) ?? null;
  const inline = variant === 'inline';
  useFloatingPanel(open && !inline, triggerRef, panelRef, { matchWidth: true });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = options.data ?? [];
    if (!q) return list;
    return list.filter((o) => [o.fullName, o.employeeCode, o.area, o.team].some((v) => v?.toLowerCase().includes(q)));
  }, [options.data, query]);

  useEffect(() => {
    if (inline) return undefined;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [inline]);

  const choose = (mrId: number | null, option: MrOption | null) => {
    onChange(mrId, option);
    if (!inline) {
      setOpen(false);
      setQuery('');
    }
  };

  const search = (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
      <Search size={14} className="text-[var(--color-muted)]" />
      <input
        autoFocus={!inline}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search name, code, area or manager"
        aria-label="Search MRs"
        className="h-8 w-full bg-transparent text-[13px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/60"
      />
      {options.data ? (
        <span className="shrink-0 text-[11px] text-[var(--color-muted)] tabular-nums">
          {filtered.length} MR{filtered.length === 1 ? '' : 's'}
        </span>
      ) : null}
    </div>
  );

  const list = (
    <ul role="listbox" aria-label={label} className={cn('overflow-y-auto py-1', inline ? 'max-h-[min(22rem,45vh)]' : 'max-h-72')}>
      {allowUnassign ? (
        <li>
          <button
            type="button"
            role="option"
            aria-selected={value === null}
            onClick={() => choose(null, null)}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2.5 text-left text-[13px] text-[var(--color-muted)] hover:bg-[var(--color-surface-subtle)]',
              value === null && inline && 'bg-[var(--color-primary-soft)]/50',
            )}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-bg)]">
              <UserX size={15} />
            </span>
            <span className="flex-1">No MR (unassigned)</span>
            {value === null && inline ? <Check size={15} className="text-[var(--color-primary)]" /> : null}
          </button>
        </li>
      ) : null}
      {options.isLoading ? <li className="px-3 py-4 text-xs text-[var(--color-muted)]">Loading MRs…</li> : null}
      {options.isError ? <li className="px-3 py-4 text-xs text-[var(--color-danger)]">Could not load the MR list.</li> : null}
      {!options.isLoading && !options.isError && filtered.length === 0 ? (
        <li className="px-3 py-4 text-xs text-[var(--color-muted)]">{query ? `No MR matches “${query}”.` : 'No active MR to assign.'}</li>
      ) : null}
      {filtered.map((o) => (
        <li key={o.id}>
          <button
            type="button"
            role="option"
            aria-selected={o.id === value}
            onClick={() => choose(o.id, o)}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-subtle)]',
              o.id === value && 'bg-[var(--color-primary-soft)]/60',
            )}
          >
            <Avatar name={o.fullName} userId={o.id} photoUrl={o.photoUrl} size="md" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold text-[var(--color-ink)]">
                <span className="truncate">{o.fullName}</span>
                {o.employeeCode ? <span className="shrink-0 font-mono text-[11px] font-normal text-[var(--color-muted)]">{o.employeeCode}</span> : null}
                {current?.id === o.id ? (
                  <span className="shrink-0 rounded-full bg-[var(--color-bg)] px-1.5 text-[10px] font-semibold text-[var(--color-muted)]">current</span>
                ) : null}
              </span>
              <span className="block truncate text-[11.5px] text-[var(--color-muted)]">{o.team || 'No manager'}</span>
              {o.area ? <span className="block truncate text-[11px] text-[var(--color-muted)]/90">{o.area}</span> : null}
            </span>
            <span className="shrink-0 text-right text-[11px] tabular-nums text-[var(--color-muted)]">
              {o.doctorCount} doctor{o.doctorCount === 1 ? '' : 's'}
            </span>
            {o.id === value ? <Check size={15} className="shrink-0 text-[var(--color-primary)]" /> : null}
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div ref={rootRef} className="relative" data-testid="mr-picker">
      <FieldLabel htmlFor={id} required={required}>
        {label}
      </FieldLabel>
      {current !== undefined ? (
        <p className="mb-1.5 text-[11px] text-[var(--color-muted)]" data-testid="mr-current">
          Currently: <span className="font-semibold text-[var(--color-ink)]">{current ? current.fullName : 'Unassigned'}</span>
        </p>
      ) : null}

      {inline ? (
        <div className={cn('overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]', error && 'border-[var(--color-danger)]')}>
          {search}
          {list}
        </div>
      ) : (
        <>
          <button
            ref={triggerRef}
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
          {open ? (
            <div ref={panelRef} data-testid="mr-panel" className="fixed z-50 overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg animate-fade-in">
              {search}
              {list}
            </div>
          ) : null}
        </>
      )}
      {error ? <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">{error}</p> : null}
    </div>
  );
}
