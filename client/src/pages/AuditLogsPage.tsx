import { useQuery } from '@tanstack/react-query';
import { Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { DataTable, Td } from '@/components/ui/DataTable';
import { auditLogsApi } from '@/services/audit-logs.service';

export function AuditLogsPage() {
  const logsQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => auditLogsApi.list(),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit Logs"
        description="Security and change history for administrators. Successful logins are recorded automatically."
      />

      <Card>
        <DataTable
          columns={['When', 'User', 'Action', 'Entity', 'IP']}
          loading={logsQuery.isLoading}
          empty={
            !logsQuery.isLoading && logsQuery.data?.length === 0 ? (
              <EmptyState
                title="No audit events yet"
                description="Events appear after admin/MR activity such as login."
              />
            ) : null
          }
        >
          {logsQuery.data?.map((log) => (
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
      </Card>
    </div>
  );
}
