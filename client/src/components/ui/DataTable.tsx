import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function DataTable({
  columns,
  children,
  loading,
  empty,
}: {
  columns: string[];
  children: ReactNode;
  loading?: boolean;
  empty?: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 text-[var(--color-muted)]">
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 font-medium whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-[var(--color-muted)]">
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
