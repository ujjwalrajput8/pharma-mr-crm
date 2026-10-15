import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IndianRupee, Plus, Receipt, Target, Zap } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, TableToolbar, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select } from '@/components/ui/Field';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useClientTable } from '@/hooks/useClientTable';
import { InvoiceCreateModal } from '@/components/sales/InvoiceCreateModal';
import { InvoiceDetailModal } from '@/components/sales/InvoiceDetailModal';
import { InvoiceStatusBadge, PartyLabel } from '@/components/sales/InvoiceStatusBadge';
import { OutstandingTab } from '@/components/sales/OutstandingTab';
import { QuickPobTab } from '@/components/sales/QuickPobTab';
import { TargetsTab } from '@/components/sales/TargetsTab';
import { invoicesApi, type InvoiceStatus } from '@/services/invoices.service';
import { formatINR } from '@/utils/currency';

type TabKey = 'invoices' | 'pob' | 'outstanding' | 'targets';

export function SalesPage() {
  const [tab, setTab] = useState<TabKey>('invoices');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Sales & Billing"
        description="Doctor/chemist-wise invoices, collections, quick POB entries and monthly targets."
      />
      <Tabs<TabKey>
        items={[
          { value: 'invoices', label: 'Invoices', icon: Receipt },
          { value: 'pob', label: 'Quick POB', icon: Zap },
          { value: 'outstanding', label: 'Party outstanding', icon: IndianRupee },
          { value: 'targets', label: 'Targets', icon: Target },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'invoices' ? <InvoicesTab /> : null}
      {tab === 'pob' ? <QuickPobTab /> : null}
      {tab === 'outstanding' ? <OutstandingTab /> : null}
      {tab === 'targets' ? <TargetsTab /> : null}
    </div>
  );
}

function InvoicesTab() {
  const [status, setStatus] = useState<'' | InvoiceStatus>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const invoicesQuery = useQuery({
    queryKey: ['invoices', { status, from, to }],
    queryFn: () =>
      invoicesApi.list({
        ...(status ? { status } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      }),
  });

  const table = useClientTable({
    data: invoicesQuery.data ?? [],
    getSearchText: (row) =>
      [row.invoiceNo, row.party?.name, row.mr.fullName, row.status, row.invoiceDate]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'invoiceNo') return row.invoiceNo;
      if (key === 'date') return row.invoiceDate;
      if (key === 'party') return row.party?.name;
      if (key === 'mr') return row.mr.fullName;
      if (key === 'total') return row.totalAmount;
      if (key === 'paid') return row.paidAmount;
      if (key === 'outstanding') return row.outstanding;
      if (key === 'status') return row.status;
      return undefined;
    },
    initialSortKey: 'date',
    initialSortDir: 'desc',
  });

  return (
    <div className="space-y-4">
      {invoicesQuery.isError ? <Alert message={getApiErrorMessage(invoicesQuery.error)} /> : null}

      <div className="flex flex-wrap items-end gap-2">
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value as '' | InvoiceStatus)}
          className="w-40"
        >
          <option value="">All statuses</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partially paid</option>
          <option value="PAID">Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
        <DatePicker label="From" value={from} onChange={setFrom} className="w-36" />
        <DatePicker label="To" value={to} onChange={setTo} className="w-36" />
      </div>

      <Card>
        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder="Search invoice no, doctor, chemist, MR…"
          actions={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus size={16} /> New Invoice
            </Button>
          }
        />
        <DataTable
          columns={[
            { key: 'invoiceNo', label: 'Invoice No', sortable: true },
            { key: 'date', label: 'Date', sortable: true },
            { key: 'party', label: 'Party', sortable: true },
            { key: 'mr', label: 'MR', sortable: true },
            { key: 'total', label: 'Total', sortable: true },
            { key: 'paid', label: 'Paid', sortable: true },
            { key: 'outstanding', label: 'Outstanding', sortable: true },
            { key: 'status', label: 'Status', sortable: true },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          loading={invoicesQuery.isLoading}
          empty={
            !invoicesQuery.isLoading && table.filteredTotal === 0 ? (
              <EmptyState
                title={table.totalAll === 0 ? 'No invoices yet' : 'No matching invoices'}
                description={
                  table.totalAll === 0
                    ? 'Raise the first doctor or chemist invoice.'
                    : 'Try different filters or another search term.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => setDetailId(row.id)}
              className="cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-bg)]/60"
            >
              <Td className="font-mono text-xs font-semibold">{row.invoiceNo}</Td>
              <Td>{row.invoiceDate}</Td>
              <Td>
                <PartyLabel party={row.party} />
              </Td>
              <Td>{row.mr.fullName}</Td>
              <Td className="font-semibold">{formatINR(row.totalAmount)}</Td>
              <Td>{formatINR(row.paidAmount)}</Td>
              <Td
                className={
                  row.outstanding > 0 && row.status !== 'CANCELLED'
                    ? 'font-bold text-[var(--color-danger)]'
                    : undefined
                }
              >
                {formatINR(row.outstanding)}
              </Td>
              <Td>
                <InvoiceStatusBadge status={row.status} />
              </Td>
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

      <InvoiceCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(invoiceId) => setDetailId(invoiceId)}
      />
      <InvoiceDetailModal invoiceId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
