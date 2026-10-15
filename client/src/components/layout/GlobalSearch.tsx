import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CornerDownLeft, IdCard, Loader2, Pill, Search, Stethoscope } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NAV_ITEMS } from '@/constants/navigation';
import { doctorsApi } from '@/services/doctors.service';
import { employeesApi } from '@/services/employees.service';
import { medicinesApi } from '@/services/medicines.service';
import { useAuth } from '@/store/AuthContext';
import { cn } from '@/utils/cn';

const MAX_PER_GROUP = 5;
const MIN_CHARS = 2;

interface SearchResult {
  key: string;
  group: 'Pages' | 'Doctors' | 'Products' | 'Employees';
  label: string;
  sub?: string;
  icon: LucideIcon;
  to: string;
}

/**
 * Ctrl+K / Cmd+K command palette. One input, grouped results (pages by
 * permission, doctors, products, employees), full keyboard navigation.
 * Mounted once from AppLayout; the sidebar search button opens it too.
 */
export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { can, canAny } = useAuth();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  const canSearchEmployees = can('employees:view');

  // Global shortcut — toggles the palette from anywhere in the app shell.
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      } else if (event.key === 'Escape' && open) {
        onOpenChange(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  // Debounce API lookups; pages filter instantly.
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(timer);
  }, [term]);

  // Reset when closed + lock body scroll while open.
  useEffect(() => {
    if (!open) {
      setTerm('');
      setDebounced('');
      setActiveIndex(0);
      return;
    }
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const apiEnabled = open && debounced.length >= MIN_CHARS;

  const doctorsQuery = useQuery({
    queryKey: ['global-search', 'doctors', debounced],
    queryFn: () => doctorsApi.list(debounced),
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  const productsQuery = useQuery({
    queryKey: ['global-search', 'products', debounced],
    queryFn: () => medicinesApi.list(debounced),
    enabled: apiEnabled,
    staleTime: 30_000,
  });
  const employeesQuery = useQuery({
    queryKey: ['global-search', 'employees', debounced],
    queryFn: () => employeesApi.list({ search: debounced, limit: 20 }),
    enabled: apiEnabled && canSearchEmployees,
    staleTime: 30_000,
  });

  const results = useMemo<SearchResult[]>(() => {
    const needle = term.trim().toLowerCase();
    const flat: SearchResult[] = [];

    const pages = NAV_ITEMS.filter((item) => canAny(item.permissions)).filter(
      (item) => needle.length === 0 || item.label.toLowerCase().includes(needle),
    );
    for (const item of pages.slice(0, MAX_PER_GROUP)) {
      flat.push({
        key: `page:${item.path}`,
        group: 'Pages',
        label: item.label,
        sub: item.section,
        icon: item.icon,
        to: item.path,
      });
    }

    if (apiEnabled) {
      for (const doctor of (doctorsQuery.data ?? []).slice(0, MAX_PER_GROUP)) {
        flat.push({
          key: `doctor:${doctor.id}`,
          group: 'Doctors',
          label: doctor.fullName,
          sub: [doctor.specialization, doctor.city].filter(Boolean).join(' · ') || undefined,
          icon: Stethoscope,
          to: `/doctors/${doctor.id}`,
        });
      }
      for (const medicine of (productsQuery.data ?? []).slice(0, MAX_PER_GROUP)) {
        flat.push({
          key: `product:${medicine.id}`,
          group: 'Products',
          label: medicine.name,
          sub: [medicine.company, medicine.category].filter(Boolean).join(' · ') || undefined,
          icon: Pill,
          to: `/medicines/${medicine.id}`,
        });
      }
      for (const employee of (employeesQuery.data ?? []).slice(0, MAX_PER_GROUP)) {
        flat.push({
          key: `employee:${employee.id}`,
          group: 'Employees',
          label: employee.fullName,
          sub: [employee.role, employee.designation].filter(Boolean).join(' · ') || undefined,
          icon: IdCard,
          to: `/employees/${employee.id}`,
        });
      }
    }

    return flat;
  }, [term, apiEnabled, canAny, doctorsQuery.data, productsQuery.data, employeesQuery.data]);

  // Keep the highlight inside the list as results change.
  useEffect(() => {
    setActiveIndex((index) => (results.length === 0 ? 0 : Math.min(index, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  const isSearching =
    apiEnabled &&
    (doctorsQuery.isFetching || productsQuery.isFetching || employeesQuery.isFetching);
  const showEmpty = results.length === 0 && !isSearching;

  function go(result: SearchResult | undefined) {
    if (!result) return;
    onOpenChange(false);
    navigate(result.to);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (results.length > 0) setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (results.length > 0)
        setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(results[activeIndex]);
    }
  }

  let lastGroup: SearchResult['group'] | null = null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-[12vh] sm:pt-[14vh]">
      <button
        type="button"
        aria-label="Close search"
        className="fixed inset-0 bg-slate-950/55 backdrop-blur-[2px] animate-fade-in"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="relative z-10 flex max-h-[62vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] animate-scale-in"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--color-border)] px-4 py-3">
          {isSearching ? (
            <Loader2 size={16} className="shrink-0 animate-spin text-[var(--color-primary)]" />
          ) : (
            <Search size={16} className="shrink-0 text-[var(--color-muted)]" />
          )}
          <input
            autoFocus
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages, doctors, products…"
            className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/70"
            aria-label="Search"
          />
          <kbd className="hidden shrink-0 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--color-muted)] sm:inline">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {showEmpty ? (
            <p className="px-4 py-8 text-center text-xs text-[var(--color-muted)]">
              {term.trim().length >= MIN_CHARS
                ? 'No matches — try another name.'
                : 'Type to search. Doctors, products and employees need at least 2 characters.'}
            </p>
          ) : (
            results.map((result, index) => {
              const Icon = result.icon;
              const header = result.group !== lastGroup ? result.group : null;
              lastGroup = result.group;
              const active = index === activeIndex;
              return (
                <div key={result.key}>
                  {header ? (
                    <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold tracking-[0.12em] text-[var(--color-muted)] uppercase">
                      {header}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    data-active={active || undefined}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(result)}
                    className={cn(
                      'flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left transition-colors',
                      active ? 'bg-[var(--color-primary-soft)]' : 'hover:bg-[var(--color-bg)]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                        active
                          ? 'bg-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-bg)] text-[var(--color-muted)]',
                      )}
                    >
                      <Icon size={13} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-[var(--color-ink)]">
                        {result.label}
                      </span>
                      {result.sub ? (
                        <span className="block truncate text-[11px] text-[var(--color-muted)]">
                          {result.sub}
                        </span>
                      ) : null}
                    </span>
                    {active ? (
                      <CornerDownLeft size={13} className="shrink-0 text-[var(--color-muted)]" />
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50 px-4 py-2 text-[10px] font-medium text-[var(--color-muted)]">
          <span>↑↓ navigate</span>
          <span>Enter open</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}
