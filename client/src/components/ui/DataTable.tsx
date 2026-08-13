import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
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
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            {normalized.map((column) => {
              const active = sortKey === column.key;
              const canSort = Boolean(column.sortable && onSort);
              return (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-2.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-[var(--color-muted)] uppercase',
                    column.className,
                  )}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => onSort?.(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1 transition hover:text-[var(--color-ink)]',
                        active && 'text-[var(--color-ink)]',
                      )}
                    >
                      {column.label}
                      {active && sortDir === 'asc' ? (
                        <ArrowUp size={12} />
                      ) : active && sortDir === 'desc' ? (
                        <ArrowDown size={12} />
                      ) : (
                        <ArrowUpDown size={12} className="opacity-40" />
                      )}
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
                className="px-4 py-12 text-center text-sm text-[var(--color-muted)]"
              >
                Loading…
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
        'px-4 py-2.5 align-middle text-sm text-[var(--color-ink)] tabular-nums',
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
    <div className="mb-0 flex flex-col gap-3 border-b border-[var(--color-border)] px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <div className="relative w-full sm:max-w-sm">
        <Search
          size={15}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--color-muted)]"
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] py-2 pr-3 pl-9 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15"
        />
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
    <div className="flex flex-col gap-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
      <p className="text-xs text-[var(--color-muted)]">
        {total === 0 ? 'No results' : (
          <>
            <span className="font-medium text-[var(--color-ink)]">
              {from}–{to}
            </span>{' '}
            of {total}
          </>
        )}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <label className="flex items-center gap-2 text-xs text-[var(--color-muted)]">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-2 text-xs text-[var(--color-ink)] outline-none"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-[var(--color-ink)] transition hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
          </button>
          <span className="min-w-[4.5rem] text-center text-xs font-medium text-[var(--color-ink)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] text-[var(--color-ink)] transition hover:bg-[var(--color-surface)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
