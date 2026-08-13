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
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 text-[var(--color-muted)]">
            {normalized.map((column) => {
              const active = sortKey === column.key;
              const canSort = Boolean(column.sortable && onSort);
              return (
                <th
                  key={column.key}
                  className={cn('px-4 py-3 font-medium whitespace-nowrap', column.className)}
                >
                  {canSort ? (
                    <button
                      type="button"
                      onClick={() => onSort?.(column.key)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-md transition hover:text-[var(--color-ink)]',
                        active && 'text-[var(--color-ink)]',
                      )}
                    >
                      {column.label}
                      {active && sortDir === 'asc' ? (
                        <ArrowUp size={14} />
                      ) : active && sortDir === 'desc' ? (
                        <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} className="opacity-50" />
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
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={normalized.length}
                className="px-4 py-10 text-center text-[var(--color-muted)]"
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
  return <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>;
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
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--color-muted)]"
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-[#d3dee1] bg-white py-2.5 pr-3 pl-10 text-sm text-[#102226] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/20 dark:border-[var(--color-border)] dark:bg-[var(--color-bg)] dark:text-[var(--color-ink)]"
        />
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
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
    <div className="mt-4 flex flex-col gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-[var(--color-muted)]">
        {total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
          Rows
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-ink)] outline-none"
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
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink)] transition hover:bg-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-[5.5rem] text-center text-sm text-[var(--color-ink)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-ink)] transition hover:bg-[var(--color-bg)] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
