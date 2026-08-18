import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { useClientTable } from '@/hooks/useClientTable';
import { auditLogsApi } from '@/services/audit-logs.service';

export function AuditLogsPage() {
  const logsQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditLogsApi.list(),
  });

  const table = useClientTable({
    data: logsQuery.data ?? [],
    getSearchText: (log) =>
      [
        new Date(log.createdAt).toLocaleString(),
        log.user?.fullName,
        log.action,
        log.entity,
        log.entityId,
        log.ipAddress,
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'when') return row.createdAt;
      if (key === 'user') return row.user?.fullName;
      if (key === 'action') return row.action;
      if (key === 'entity') return row.entity;
      if (key === 'ip') return row.ipAddress;
      return undefined;
    },
    initialSortKey: 'when',
    initialSortDir: 'desc',
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Security and change history for administrators. Successful logins are recorded automatically."
      />

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search audit logs…"
        />
        <DataTable
          columns={[
            { key: 'when', label: 'When', sortable: true },
            { key: 'user', label: 'User', sortable: true },
            { key: 'action', label: 'Action', sortable: true },
            { key: 'entity', label: 'Entity', sortable: true },
            { key: 'ip', label: 'IP', sortable: true },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={logsQuery.isLoading}
          empty={
            !logsQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No audit events yet' : 'No matching events'}
                description={
                  table.totalAll === 0
                    ? 'Events appear after admin/MR activity such as login.'
                    : 'Try a different search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((log) => (
            <tr key={log.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="whitespace-nowrap">{new Date(log.createdAt).toLocaleString()}</Td>
              <Td>{log.user?.fullName ?? '—'}</Td>
              <Td className="font-medium">{log.action}</Td>
              <Td>
                {log.entity}
                {log.entityId ? (
                  <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                    {log.entityId}
                  </span>
                ) : null}
              </Td>
              <Td>{log.ipAddress ?? '—'}</Td>
            </tr>
          ))}
        </DataTable>
        <TablePagination
          page={table.page}
          totalPages={table.totalPages}
          from={table.from}
          to={table.to}
          total={table.filteredTotal}
          pageSize={table.pageSize}
          pageSizeOptions={table.pageSizeOptions}
          onPageChange={table.setPage}
          onPageSizeChange={table.setPageSize}
        />
      </Card>
    </div>
  );
}
