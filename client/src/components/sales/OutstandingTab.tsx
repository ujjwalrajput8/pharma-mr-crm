import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, IndianRupee, Stethoscope, Store, Wallet } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { Alert, Card, EmptyState, StatTile } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useClientTable } from '@/hooks/useClientTable';
import { invoicesApi } from '@/services/invoices.service';
import { formatINR, formatINRCompact } from '@/utils/currency';
import { downloadCsv } from '@/utils/exportReport';

type GroupBy = 'doctor' | 'store';

/** Doctor / chemist wise billed vs collected — the "doctor wise billing record". */
export function OutstandingTab() {
  const [groupBy, setGroupBy] = useState<GroupBy>('doctor');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const summaryQuery = useQuery({
    queryKey: ['invoice-summary', groupBy, from, to],
    queryFn: () =>
      invoicesApi.summary({
        groupBy,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
  });
  const groups = summaryQuery.data?.groups ?? [];
  const totals = summaryQuery.data?.totals;

  const table = useClientTable({
    data: groups,
    getSearchText: (row) => row.name,
    getSortValue: (row, key) => {
      if (key === 'name') return row.name;
      if (key === 'invoices') return row.invoices;
      if (key === 'billed') return row.billed;
      if (key === 'paid') return row.paid;
      if (key === 'outstanding') return row.outstanding;
      if (key === 'last') return row.lastInvoiceDate;
      return undefined;
    },
    initialSortKey: 'outstanding',
    initialSortDir: 'desc',
  });

  function exportCsv() {
    downloadCsv(
      `${groupBy === 'doctor' ? 'doctor' : 'chemist'}-wise-billing`,
      groups.map((row) => ({
        Name: row.name,
        Invoices: row.invoices,
        'Billed ₹': row.billed.toFixed(2),
        'Paid ₹': row.paid.toFixed(2),
        'Outstanding ₹': row.outstanding.toFixed(2),
        'Last invoice': row.lastInvoiceDate ?? '',
      })),
      {
        'Group by': groupBy === 'doctor' ? 'Doctor' : 'Chemist',
        Range: from || to ? `${from || 'start'} → ${to || 'today'}` : 'All time',
        'Total billed ₹': (totals?.billed ?? 0).toFixed(2),
        'Total paid ₹': (totals?.paid ?? 0).toFixed(2),
        'Total outstanding ₹': (totals?.outstanding ?? 0).toFixed(2),
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Tabs<GroupBy>
          items={[
            { value: 'doctor', label: 'Doctor-wise', icon: Stethoscope },
            { value: 'store', label: 'Chemist-wise', icon: Store },
          ]}
          value={groupBy}
          onChange={setGroupBy}
        />
        <div className="flex flex-wrap items-end gap-2">
          <DatePicker label="From" value={from} onChange={setFrom} className="w-36" />
          <DatePicker label="To" value={to} onChange={setTo} className="w-36" />
          <Button variant="secondary" onClick={exportCsv} disabled={groups.length === 0}>
            <Download size={14} /> Export CSV
          </Button>
        </div>
      </div>

      {summaryQuery.isError ? <Alert message={getApiErrorMessage(summaryQuery.error)} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Total billed"
          value={formatINRCompact(totals?.billed ?? 0)}
          hint={`${totals?.invoices ?? 0} invoice(s)`}
          icon={IndianRupee}
          tone="primary"
        />
        <StatTile
          label="Total paid"
          value={formatINRCompact(totals?.paid ?? 0)}
          icon={Wallet}
          tone="success"
        />
        <StatTile
          label="Total outstanding"
          value={formatINRCompact(totals?.outstanding ?? 0)}
          icon={IndianRupee}
          tone={(totals?.outstanding ?? 0) > 0 ? 'danger' : 'neutral'}
        />
      </div>

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder={groupBy === 'doctor' ? 'Search doctors…' : 'Search chemists…'}
        />
        <DataTable
          columns={[
            { key: 'name', label: groupBy === 'doctor' ? 'Doctor' : 'Chemist', sortable: true },
            { key: 'invoices', label: 'Invoices', sortable: true },
            { key: 'billed', label: 'Billed', sortable: true },
            { key: 'paid', label: 'Paid', sortable: true },
            { key: 'outstanding', label: 'Outstanding', sortable: true },
            { key: 'last', label: 'Last invoice', sortable: true },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={summaryQuery.isLoading}
          empty={
            !summaryQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title="No billing yet"
                description="Raise the first invoice to see party-wise outstanding here."
              />
            ) : null
          }
        >
          {table.rows.map((row) => (
            <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">{row.name}</Td>
              <Td>{row.invoices}</Td>
              <Td>{formatINR(row.billed)}</Td>
              <Td>{formatINR(row.paid)}</Td>
              <Td
                className={
                  row.outstanding > 0 ? 'font-bold text-[var(--color-danger)]' : 'font-semibold'
                }
              >
                {formatINR(row.outstanding)}
              </Td>
              <Td>{row.lastInvoiceDate ?? '—'}</Td>
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
