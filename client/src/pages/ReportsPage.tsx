import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Page';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Select } from '@/components/ui/Field';
import { DatePicker } from '@/components/ui/DatePicker';
import { useAuth } from '@/store/AuthContext';
import { reportsApi, type ReportType } from '@/services/reports.service';
import { usersApi } from '@/services/users.service';
import { doctorsApi } from '@/services/doctors.service';
import { medicinesApi } from '@/services/medicines.service';
import { storesApi } from '@/services/stores.service';
import { downloadCsv, printReportPdf } from '@/utils/exportReport';

const adminReports: Array<{ value: ReportType; label: string }> = [
  { value: 'daily', label: 'Daily Report' },
  { value: 'weekly', label: 'Weekly Report' },
  { value: 'monthly', label: 'Monthly Report' },
  { value: 'mr-performance', label: 'MR Performance' },
  { value: 'mr-detail', label: 'MR Detail Report' },
  { value: 'doctor-visits', label: 'Doctor Visit Report' },
  { value: 'appointments', label: 'Appointment Report' },
  { value: 'distributions', label: 'Medicine Distribution Report' },
  { value: 'sales', label: 'Sales Report' },
  { value: 'stock', label: 'Stock Report' },
];

const mrReports: Array<{ value: ReportType; label: string }> = [
  { value: 'daily', label: 'My Daily Report' },
  { value: 'monthly', label: 'My Monthly Report' },
  { value: 'mr-detail', label: 'My Performance Report' },
  { value: 'doctor-visits', label: 'My Visit Report' },
  { value: 'appointments', label: 'My Appointment Report' },
  { value: 'distributions', label: 'My Sample Report' },
  { value: 'sales', label: 'My Sales Report' },
];

export function ReportsPage() {
  const { can } = useAuth();
  const isAdmin = can('reports:all');
  const options = isAdmin ? adminReports : mrReports;
  const [type, setType] = useState<ReportType>(options[0]?.value ?? 'daily');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [mrId, setMrId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [medicineId, setMedicineId] = useState('');
  const [medicalStoreId, setMedicalStoreId] = useState('');
  const [status, setStatus] = useState('');

  const filtersQuery = useQuery({
    queryKey: ['report-filter-options'],
    queryFn: async () => {
      const [mrs, doctors, medicines, stores] = await Promise.all([
        isAdmin ? usersApi.list() : Promise.resolve([]),
        doctorsApi.list(),
        medicinesApi.list(),
        isAdmin ? storesApi.list() : Promise.resolve([]),
      ]);
      return { mrs, doctors, medicines, stores };
    },
  });

  const reportQuery = useQuery({
    queryKey: ['reports', type, from, to, mrId, doctorId, medicineId, medicalStoreId, status],
    queryFn: () =>
      reportsApi.get({
        type,
        from: from || undefined,
        to: to || undefined,
        mrId: mrId || undefined,
        doctorId: doctorId || undefined,
        medicineId: medicineId || undefined,
        medicalStoreId: medicalStoreId || undefined,
        status: status || undefined,
      }),
  });

  const columns = useMemo(() => {
    const rows = reportQuery.data?.rows ?? [];
    if (rows.length === 0) return [] as string[];
    return Object.keys(rows[0] ?? {});
  }, [reportQuery.data]);

  function exportExcel() {
    if (!reportQuery.data) return;
    downloadCsv(
      `report-${type}-${reportQuery.data.range.from}-${reportQuery.data.range.to}.csv`,
      reportQuery.data.rows,
      reportQuery.data.summary,
    );
  }

  function exportPdf() {
    if (!reportQuery.data) return;
    const summaryHtml = `<div class="summary">${Object.entries(reportQuery.data.summary)
      .map(
        ([key, value]) =>
          `<div><div class="muted">${key}</div><strong>${value}</strong></div>`,
      )
      .join('')}</div>`;
    const tableHtml =
      columns.length === 0
        ? '<p class="muted">No tabular rows for this report.</p>'
        : `<table><thead><tr>${columns.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${reportQuery.data.rows
            .map(
              (row) =>
                `<tr>${columns.map((c) => `<td>${String(row[c] ?? '')}</td>`).join('')}</tr>`,
            )
            .join('')}</tbody></table>`;
    printReportPdf(
      `${type} report (${reportQuery.data.range.label})`,
      `<p class="muted">${reportQuery.data.range.from} → ${reportQuery.data.range.to}</p>${summaryHtml}${tableHtml}`,
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description={
          isAdmin
            ? 'Filter by date, MR, doctor, medicine, store and status. Export Excel or PDF.'
            : 'Your personal field activity reports with export.'
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportExcel} disabled={!reportQuery.data}>
              Export Excel
            </Button>
            <Button variant="secondary" onClick={exportPdf} disabled={!reportQuery.data}>
              Export PDF
            </Button>
          </div>
        }
      />

      <Card className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Select label="Report type" value={type} onChange={(e) => setType(e.target.value as ReportType)}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <DatePicker label="From" value={from} onChange={setFrom} />
        <DatePicker label="To" value={to} onChange={setTo} />
        {isAdmin ? (
          <Select label="MR" value={mrId} onChange={(e) => setMrId(e.target.value)}>
            <option value="">All MRs</option>
            {filtersQuery.data?.mrs.map((mr) => (
              <option key={mr.id} value={mr.id}>
                {mr.fullName}
              </option>
            ))}
          </Select>
        ) : null}
        <Select label="Doctor" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
          <option value="">All doctors</option>
          {filtersQuery.data?.doctors.map((doctor) => (
            <option key={doctor.id} value={doctor.id}>
              {doctor.fullName}
            </option>
          ))}
        </Select>
        <Select label="Medicine" value={medicineId} onChange={(e) => setMedicineId(e.target.value)}>
          <option value="">All medicines</option>
          {filtersQuery.data?.medicines.map((medicine) => (
            <option key={medicine.id} value={medicine.id}>
              {medicine.name}
            </option>
          ))}
        </Select>
        {isAdmin ? (
          <Select
            label="Medical Store"
            value={medicalStoreId}
            onChange={(e) => setMedicalStoreId(e.target.value)}
          >
            <option value="">All stores</option>
            {filtersQuery.data?.stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </Select>
        ) : null}
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="PENDING">Pending</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="RESCHEDULED">Rescheduled</option>
        </Select>
        {(from || to || mrId || doctorId || medicineId || medicalStoreId || status) && (
          <div className="flex items-end">
            <Button
              variant="secondary"
              onClick={() => {
                setFrom('');
                setTo('');
                setMrId('');
                setDoctorId('');
                setMedicineId('');
                setMedicalStoreId('');
                setStatus('');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
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
            {type === 'mr-detail' && isAdmin && !mrId ? (
              <span className="ml-2 text-[var(--color-danger)]">
                Select an MR filter for MR Detail report.
              </span>
            ) : null}
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
