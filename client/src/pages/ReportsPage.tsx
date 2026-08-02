import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Card, PageHeader } from '@/components/ui/Page';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { useAuth } from '@/store/AuthContext';
import { reportsApi, type ReportType } from '@/services/reports.service';

const adminReports: Array<{ value: ReportType; label: string }> = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'monthly', label: 'Monthly Report' },
  { value: 'mr-performance', label: 'MR Performance' },
  { value: 'doctor-visits', label: 'Doctor Visit Report' },
  { value: 'appointments', label: 'Appointment Report' },
  { value: 'distributions', label: 'Medicine Distribution Report' },
  { value: 'stock', label: 'Stock Report' },
];

const mrReports: Array<{ value: ReportType; label: string }> = [
  { value: 'daily', label: 'My Daily Report' },
  { value: 'monthly', label: 'My Monthly Report' },
  { value: 'doctor-visits', label: 'My Visit Report' },
  { value: 'appointments', label: 'My Appointment Report' },
  { value: 'distributions', label: 'My Sample Report' },
];

export function ReportsPage() {
  const { user } = useAuth();
  const options = user?.role === 'ADMIN' ? adminReports : mrReports;
  const [type, setType] = useState<ReportType>(options[0]?.value ?? 'daily');

  const reportQuery = useQuery({
    queryKey: ['reports', type],
    queryFn: () => reportsApi.get(type),
  });

  const columns = useMemo(() => {
    const rows = reportQuery.data?.rows ?? [];
    if (rows.length === 0) return [] as string[];
    return Object.keys(rows[0] ?? {});
  }, [reportQuery.data]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description={
          user?.role === 'ADMIN'
            ? 'Organization-wide operational and performance reporting.'
            : 'Your personal field activity reports.'
        }
      />

      <Card className="p-4">
        <Select
          label="Report type"
          value={type}
          onChange={(e) => setType(e.target.value as ReportType)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Card>

      {reportQuery.isLoading ? (
        <Card className="p-8 text-sm text-[var(--color-muted)]">Generating report…</Card>
      ) : reportQuery.data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Object.entries(reportQuery.data.summary).map(([key, value]) => (
              <Card key={key} className="p-4">
                <p className="text-sm capitalize text-[var(--color-muted)]">
                  {key.replace(/([A-Z])/g, ' $1')}
                </p>
                <p className="mt-1 text-2xl font-semibold text-[var(--color-ink)]">{value}</p>
              </Card>
            ))}
          </div>

          <Card className="p-4 text-sm text-[var(--color-muted)]">
            Period: {reportQuery.data.range.label} ({reportQuery.data.range.from} →{' '}
            {reportQuery.data.range.to})
          </Card>

          {columns.length > 0 ? (
            <Card>
              <DataTable columns={columns.map((c) => c)} loading={false}>
                {reportQuery.data.rows.map((row, index) => (
                  <tr key={index} className="border-b border-[var(--color-border)] last:border-0">
                    {columns.map((column) => (
                      <Td key={column}>{String(row[column] ?? '—')}</Td>
                    ))}
                  </tr>
                ))}
              </DataTable>
            </Card>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
