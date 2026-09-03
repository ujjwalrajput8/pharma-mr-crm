import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { SortDir } from '@/hooks/useClientTable';

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  className?: string;
}

export function DataTable({
  columns,
  children,
  loading,
  empty,
  sortKey,
  sortDir,
  onSort,
}: {
  columns: Array<string | DataTableColumn>;
  children: ReactNode;
  loading?: boolean;
  empty?: ReactNode;
  sortKey?: string;
  sortDir?: SortDir;
  onSort?: (key: string) => void;
}) {
  const normalized: DataTableColumn[] = columns.map((column, index) =>
    typeof column === 'string'
      ? { key: `col-${index}`, label: column, sortable: false }
      : column,
  );

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80">
            {normalized.map((column) => {
              const active = sortKey === column.key;
              const canSort = Boolean(column.sortable && onSort);
              return (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-[11px] font-bold tracking-wider whitespace-nowrap text-[var(--color-muted)] uppercase',
                    column.className,
                  )}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => onSort?.(column.key)}
                      className={cn(
                        'group inline-flex items-center gap-1.5 font-bold transition-colors cursor-pointer select-none',
                        active
                          ? 'text-[var(--color-primary)]'
                          : 'hover:text-[var(--color-ink)]',
                      )}
                    >
                      <span>{column.label}</span>
                      <span className="flex items-center">
                        {active && sortDir === 'asc' ? (
                          <ArrowUp size={13} className="text-[var(--color-primary)] stroke-[2.5]" />
                        ) : active && sortDir === 'desc' ? (
                          <ArrowDown size={13} className="text-[var(--color-primary)] stroke-[2.5]" />
                        ) : (
                          <ArrowUpDown size={12} className="opacity-30 transition-opacity group-hover:opacity-75" />
                        )}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {loading ? (
            <tr>
              <td
                colSpan={normalized.length}
                className="px-4 py-16 text-center text-sm text-[var(--color-muted)]"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
                  <span className="text-xs font-medium">Loading data…</span>
                </div>
              </td>
            </tr>
          ) : null}
          {!loading ? children : null}
        </tbody>
      </table>
      {!loading ? empty : null}
    </div>
  );
}

export function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td
      className={cn(
        'px-4 py-3.5 align-middle text-sm text-[var(--color-ink)] tabular-nums transition-colors',
        className,
      )}
    >
      {children}
    </td>
  );
}

export function TableToolbar({
  search,
  onSearchChange,
  placeholder = 'Search…',
  actions,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-0 flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs md:max-w-sm">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--color-muted)]"
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="h-9.5 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] py-2 pr-8 pl-9.5 text-sm text-[var(--color-ink)] shadow-xs outline-none transition-all placeholder:text-[var(--color-muted)]/60 focus:border-[var(--color-primary)] focus:ring-3 focus:ring-[var(--color-primary)]/15"
        />
        {search ? (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-full p-0.5 text-[var(--color-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-ink)]"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center [&_button]:w-full sm:[&_button]:w-auto">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function TablePagination({
  page,
  totalPages,
  from,
  to,
  total,
  pageSize,
  pageSizeOptions = [5, 10, 20, 50],
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  pageSize: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--color-muted)] border border-[var(--color-border)] shadow-xs">
          {total === 0 ? '0 records' : `${from}–${to} of ${total}`}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--color-muted)]">
          <span>Rows:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-medium text-[var(--color-ink)] shadow-xs outline-none transition focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15 cursor-pointer"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-xs transition hover:bg-[var(--color-bg)] hover:border-[var(--color-border-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[4rem] text-center text-xs font-semibold text-[var(--color-ink)] tabular-nums">
            {page} / {Math.max(totalPages, 1)}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] shadow-xs transition hover:bg-[var(--color-bg)] hover:border-[var(--color-border-strong)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
