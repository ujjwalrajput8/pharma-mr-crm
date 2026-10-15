import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  BookOpen,
  Download,
  FileSpreadsheet,
  PackageCheck,
  Scale,
  Search,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DataTable, TablePagination, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import {
  Alert,
  Badge,
  Card,
  DetailRow,
  EmptyState,
  PageHeader,
  StatTile,
} from '@/components/ui/Page';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Tabs } from '@/components/ui/Tabs';
import {
  ledgerApi,
  type LedgerHolderRef,
  type LedgerTxn,
  type LedgerTxnFilters,
} from '@/services/ledger.service';
import { medicinesApi } from '@/services/medicines.service';
import { toIsoDate } from '@/utils/datetime';
import { downloadCsv } from '@/utils/exportReport';

type Tab = 'ledger' | 'receipts' | 'statement';

const TXN_TYPES = [
  'OPENING',
  'RECEIPT',
  'TRANSFER',
  'ISSUE',
  'SAMPLE_GIVEN',
  'GIFT_GIVEN',
  'SALE',
  'RETURN',
  'EXPIRY_WRITEOFF',
  'ADJUSTMENT',
  'LOST',
] as const;

const IN_TYPES = new Set(['OPENING', 'RECEIPT', 'RETURN']);
const OUT_TYPES = new Set([
  'ISSUE',
  'TRANSFER',
  'SAMPLE_GIVEN',
  'GIFT_GIVEN',
  'SALE',
  'EXPIRY_WRITEOFF',
  'LOST',
]);

const HOLDER_LABEL: Record<string, string> = {
  WAREHOUSE: 'Warehouse',
  USER: 'MR',
  DOCTOR: 'Doctor',
  CHEMIST: 'Chemist',
};

function typeTone(txnType: string): 'success' | 'danger' | 'neutral' {
  if (IN_TYPES.has(txnType)) return 'success';
  if (OUT_TYPES.has(txnType)) return 'danger';
  return 'neutral'; // ADJUSTMENT and other count corrections
}

function holderText(ref: LedgerHolderRef | null): string {
  if (!ref) return '—';
  return ref.name ?? `${HOLDER_LABEL[ref.type] ?? ref.type} #${ref.id}`;
}

/** +qty into the warehouse, −qty out of it; null when the row never touches it. */
function warehouseSign(txn: LedgerTxn): 1 | -1 | null {
  if (txn.to?.type === 'WAREHOUSE') return 1;
  if (txn.from?.type === 'WAREHOUSE') return -1;
  return null;
}

function useMedicineOptions() {
  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
  });
  return useMemo(
    () =>
      (medicinesQuery.data ?? []).map((medicine) => ({
        value: String(medicine.id),
        label: medicine.name,
        meta: medicine.company ?? undefined,
      })),
    [medicinesQuery.data],
  );
}

export function LedgerPage() {
  const [tab, setTab] = useState<Tab>('ledger');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Ledger explorer"
        description="Every stock movement, append-only: kab stock aaya, kisne daala, kahan gaya — and the statement that must match the balances."
      />

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'ledger', label: 'Ledger', icon: BookOpen },
          { value: 'receipts', label: 'Receipts (GRN)', icon: PackageCheck },
          { value: 'statement', label: 'Statement', icon: Scale },
        ]}
      />

      {tab === 'ledger' ? <LedgerTab /> : null}
      {tab === 'receipts' ? <ReceiptsTab /> : null}
      {tab === 'statement' ? <StatementTab /> : null}
    </div>
  );
}

// ── Ledger tab ────────────────────────────────────────────────────────────────

function LedgerTab() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [medicineId, setMedicineId] = useState('');
  const [txnType, setTxnType] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: LedgerTxnFilters = useMemo(
    () => ({
      from: from || undefined,
      to: to || undefined,
      medicineId: medicineId ? Number(medicineId) : undefined,
      txnType: txnType || undefined,
      search: search || undefined,
    }),
    [from, to, medicineId, txnType, search],
  );

  const txnsQuery = useQuery({
    queryKey: ['ledger-txns', { ...filters, page, limit }],
    queryFn: () => ledgerApi.listTxns({ ...filters, page, limit }),
    placeholderData: keepPreviousData,
  });

  const medicineOptions = useMedicineOptions();
  const items = txnsQuery.data?.items ?? [];
  const meta = txnsQuery.data?.meta;
  const summary = txnsQuery.data?.summary;

  async function exportCsv() {
    setExporting(true);
    setError(null);
    try {
      const result = await ledgerApi.listTxns({ ...filters, page: 1, limit: 2000 });
      downloadCsv(
        `stock-ledger-${toIsoDate(new Date())}`,
        result.items.map((txn) => {
          const sign = warehouseSign(txn);
          return {
            Date: txn.txnDate,
            'Txn No': txn.txnNo,
            Type: txn.txnType,
            Medicine: txn.medicine.name,
            Batch: txn.batch.batchNo,
            From: holderText(txn.from),
            To: holderText(txn.to),
            Qty: sign === null ? txn.qty : sign * txn.qty,
            'Receipt / Ref': txn.receiptNo ?? txn.refType ?? '',
            Note: txn.note ?? '',
            By: txn.createdBy?.fullName ?? '',
          };
        }),
        {
          'From date': from || 'All',
          'To date': to || 'All',
          'Txn type': txnType || 'All',
          'Total units in': result.summary.totalIn,
          'Total units out': result.summary.totalOut,
          'Rows exported': result.items.length,
        },
      );
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  function updateFilter(update: () => void) {
    update();
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {error ? <Alert message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DatePicker label="From" value={from} onChange={(value) => updateFilter(() => setFrom(value))} />
        <DatePicker label="To" value={to} onChange={(value) => updateFilter(() => setTo(value))} />
        <SearchableSelect
          label="Medicine"
          value={medicineId}
          onChange={(value) => updateFilter(() => setMedicineId(value))}
          options={medicineOptions}
          placeholder="All medicines"
        />
        <Select
          label="Txn type"
          value={txnType}
          onChange={(event) => updateFilter(() => setTxnType(event.target.value))}
        >
          <option value="">All types</option>
          {TXN_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        <Input
          label="Search"
          icon={Search}
          placeholder="Txn no, note or medicine…"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>

      {summary ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Units in"
            value={summary.totalIn.toLocaleString('en-IN')}
            icon={ArrowDownToLine}
            tone="success"
            hint="Received side of the filtered rows"
          />
          <StatTile
            label="Units out"
            value={summary.totalOut.toLocaleString('en-IN')}
            icon={ArrowUpFromLine}
            tone="danger"
            hint="Issued side of the filtered rows"
          />
          <StatTile
            label="Movements"
            value={(meta?.total ?? 0).toLocaleString('en-IN')}
            icon={BookOpen}
          />
          <StatTile
            label="Export"
            value="CSV"
            icon={Download}
            tone="primary"
            hint={exporting ? 'Preparing…' : 'Current filter, up to 2,000 rows'}
            onClick={() => {
              if (!exporting) void exportCsv();
            }}
          />
        </div>
      ) : null}

      <Card>
        <DataTable
          columns={[
            'Date',
            'Txn No',
            'Type',
            'Medicine',
            'From → To',
            'Qty',
            'Receipt / Ref',
            'By',
          ]}
          loading={txnsQuery.isLoading}
          empty={
            !txnsQuery.isLoading && items.length === 0 ? (
              <EmptyState
                title="No ledger rows"
                description="No stock movement matches this filter. Widen the date range or clear a filter."
              />
            ) : null
          }
        >
          {items.map((txn) => {
            const sign = warehouseSign(txn);
            return (
              <tr key={txn.id} className="border-b border-[var(--color-border)] last:border-0">
                <Td className="whitespace-nowrap">{txn.txnDate}</Td>
                <Td className="font-mono text-xs">{txn.txnNo}</Td>
                <Td>
                  <Badge tone={typeTone(txn.txnType)}>{txn.txnType.replace(/_/g, ' ')}</Badge>
                </Td>
                <Td>
                  <span className="font-medium">{txn.medicine.name}</span>
                  <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                    Batch {txn.batch.batchNo}
                    {txn.batch.expiryDate ? ` · exp ${txn.batch.expiryDate}` : ''}
                  </span>
                </Td>
                <Td>
                  <span className="text-xs">
                    {holderText(txn.from)}{' '}
                    <span className="text-[var(--color-muted)]">→</span> {holderText(txn.to)}
                  </span>
                </Td>
                <Td>
                  <span
                    className={
                      sign === 1
                        ? 'font-semibold text-[var(--color-success)]'
                        : sign === -1
                          ? 'font-semibold text-[var(--color-danger)]'
                          : 'font-semibold'
                    }
                  >
                    {sign === 1 ? '+' : sign === -1 ? '−' : ''}
                    {txn.qty}
                  </span>
                  {txn.runningBalance !== null ? (
                    <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                      bal {txn.runningBalance}
                    </span>
                  ) : null}
                </Td>
                <Td>
                  {txn.receiptNo ? (
                    <span className="font-mono text-xs">{txn.receiptNo}</span>
                  ) : (
                    <span className="text-xs text-[var(--color-muted)]">
                      {txn.refType ?? '—'}
                    </span>
                  )}
                </Td>
                <Td className="text-xs">{txn.createdBy?.fullName ?? '—'}</Td>
              </tr>
            );
          })}
        </DataTable>
        <TablePagination
          page={meta?.page ?? page}
          totalPages={meta?.totalPages ?? 1}
          from={meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0}
          to={meta ? Math.min(meta.page * meta.limit, meta.total) : 0}
          total={meta?.total ?? 0}
          pageSize={limit}
          pageSizeOptions={[25, 50, 100, 200]}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setLimit(size);
            setPage(1);
          }}
        />
      </Card>
    </div>
  );
}

// ── Receipts (GRN) tab ────────────────────────────────────────────────────────

function ReceiptsTab() {
  const [page, setPage] = useState(1);
  const [openReceiptId, setOpenReceiptId] = useState<number | null>(null);
  const limit = 50;

  const receiptsQuery = useQuery({
    queryKey: ['ledger-receipts', { page, limit }],
    queryFn: () => ledgerApi.listReceipts({ page, limit }),
    placeholderData: keepPreviousData,
  });

  const detailQuery = useQuery({
    queryKey: ['ledger-receipt', openReceiptId],
    queryFn: () => ledgerApi.getReceipt(openReceiptId!),
    enabled: openReceiptId !== null,
  });

  const items = receiptsQuery.data?.items ?? [];
  const meta = receiptsQuery.data?.meta;
  const detail = detailQuery.data;

  return (
    <div className="space-y-4">
      <Card>
        <DataTable
          columns={['Receipt No', 'Date', 'Source', 'Invoice', 'File', 'Units', 'Lines', 'By']}
          loading={receiptsQuery.isLoading}
          empty={
            !receiptsQuery.isLoading && items.length === 0 ? (
              <EmptyState
                title="No goods receipts yet"
                description="A GRN is written every time stock comes in — through a medicine import or a positive manual adjustment."
              />
            ) : null
          }
        >
          {items.map((receipt) => (
            <tr
              key={receipt.id}
              onClick={() => setOpenReceiptId(receipt.id)}
              className="cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-bg)]/60"
            >
              <Td className="font-mono text-xs font-semibold text-[var(--color-primary)]">
                {receipt.receiptNo}
              </Td>
              <Td className="whitespace-nowrap">{receipt.receiptDate}</Td>
              <Td>{receipt.source ?? '—'}</Td>
              <Td>{receipt.invoiceNo ?? '—'}</Td>
              <Td className="max-w-[180px] truncate text-xs">{receipt.fileName ?? '—'}</Td>
              <Td className="font-semibold">{receipt.totalUnits.toLocaleString('en-IN')}</Td>
              <Td>{receipt.lineCount}</Td>
              <Td className="text-xs">{receipt.createdBy?.fullName ?? '—'}</Td>
            </tr>
          ))}
        </DataTable>
        <TablePagination
          page={meta?.page ?? page}
          totalPages={meta?.totalPages ?? 1}
          from={meta && meta.total > 0 ? (meta.page - 1) * meta.limit + 1 : 0}
          to={meta ? Math.min(meta.page * meta.limit, meta.total) : 0}
          total={meta?.total ?? 0}
          pageSize={limit}
          pageSizeOptions={[50]}
          onPageChange={setPage}
          onPageSizeChange={() => undefined}
        />
      </Card>

      <Modal
        open={openReceiptId !== null}
        onClose={() => setOpenReceiptId(null)}
        title={detail?.receipt.receiptNo ?? 'Goods receipt'}
        description="Receipt header and the ledger lines it produced."
        icon={FileSpreadsheet}
        className="max-w-3xl"
        footer={
          <Button variant="secondary" onClick={() => setOpenReceiptId(null)}>
            Close
          </Button>
        }
      >
        {detailQuery.isLoading ? (
          <p className="py-8 text-center text-sm text-[var(--color-muted)]">Loading receipt…</p>
        ) : detail ? (
          <div className="space-y-4">
            <dl>
              <DetailRow label="Receipt date" value={detail.receipt.receiptDate} />
              <DetailRow label="Source" value={detail.receipt.source} />
              <DetailRow label="Invoice no" value={detail.receipt.invoiceNo} mono />
              <DetailRow label="File" value={detail.receipt.fileName} mono />
              <DetailRow
                label="Total units"
                value={detail.receipt.totalUnits.toLocaleString('en-IN')}
              />
              <DetailRow label="Lines" value={detail.receipt.lineCount} />
              <DetailRow label="Created by" value={detail.receipt.createdBy?.fullName} />
              <DetailRow label="Note" value={detail.receipt.note} />
            </dl>

            <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead className="bg-[var(--color-bg)] text-[10.5px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                  <tr>
                    <th className="px-3 py-2">Medicine</th>
                    <th className="px-3 py-2">Batch</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Txn No</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.txns.map((txn) => (
                    <tr key={txn.id} className="border-t border-[var(--color-border)]">
                      <td className="px-3 py-2 font-medium">{txn.medicine.name}</td>
                      <td className="px-3 py-2">{txn.batch.batchNo}</td>
                      <td className="px-3 py-2">
                        <Badge tone={typeTone(txn.txnType)}>{txn.txnType.replace(/_/g, ' ')}</Badge>
                      </td>
                      <td className="px-3 py-2 font-semibold text-[var(--color-success)]">
                        +{txn.qty}
                      </td>
                      <td className="px-3 py-2 font-mono">{txn.txnNo}</td>
                    </tr>
                  ))}
                  {detail.txns.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[var(--color-muted)]">
                        No ledger lines reference this receipt.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

// ── Statement tab ─────────────────────────────────────────────────────────────

function StatementTab() {
  const [month, setMonth] = useState(() => toIsoDate(new Date()).slice(0, 7));
  const [medicineId, setMedicineId] = useState('');

  const range = useMemo(() => {
    if (!/^\d{4}-\d{2}$/.test(month)) return null;
    const year = Number(month.slice(0, 4));
    const monthNo = Number(month.slice(5, 7));
    const last = new Date(year, monthNo, 0).getDate();
    return {
      from: `${month}-01`,
      to: `${month}-${String(last).padStart(2, '0')}`,
    };
  }, [month]);

  const statementQuery = useQuery({
    queryKey: ['ledger-statement', range, medicineId],
    queryFn: () =>
      ledgerApi.statement({
        from: range?.from,
        to: range?.to,
        medicineId: medicineId ? Number(medicineId) : undefined,
      }),
    enabled: range !== null,
    placeholderData: keepPreviousData,
  });

  const medicineOptions = useMedicineOptions();
  const statement = statementQuery.data;

  const flatRows = useMemo(
    () =>
      (statement?.items ?? []).flatMap((item) =>
        item.batches.map((row) => ({ medicine: item.medicine, ...row })),
      ),
    [statement],
  );

  function exportCsv() {
    if (!statement) return;
    downloadCsv(
      `stock-statement-${statement.from}-to-${statement.to}`,
      flatRows.map((row) => ({
        Medicine: row.medicine.name,
        Batch: row.batch.batchNo,
        Expiry: row.batch.expiryDate ?? '',
        Opening: row.opening,
        Received: row.received,
        Issued: row.issued,
        'Write-off': row.writeOff,
        Sold: row.sold,
        Closing: row.closing,
        'Current balance': row.currentBalance,
        Match: row.matches === null ? 'n/a' : row.matches ? 'Yes' : 'NO',
      })),
      {
        Period: `${statement.from} to ${statement.to}`,
        'Received units': statement.summary.receivedUnits,
        'Issued units': statement.summary.issuedUnits,
        'Write-off units': statement.summary.writeOffUnits,
        'Sold units': statement.summary.soldUnits,
        Mismatches: statement.summary.mismatches,
      },
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Input
          label="Month"
          type="month"
          value={month}
          onChange={(event) => setMonth(event.target.value)}
        />
        <SearchableSelect
          label="Medicine"
          value={medicineId}
          onChange={setMedicineId}
          options={medicineOptions}
          placeholder="All medicines"
        />
        <div className="flex items-end">
          <Button variant="secondary" onClick={exportCsv} disabled={!statement}>
            <Download size={14} />
            Export CSV
          </Button>
        </div>
      </div>

      {statement && statement.warehouseId === null ? (
        <Alert
          tone="warning"
          message="No default warehouse is configured (Settings → stock.default_warehouse_id), so there is nothing to reconcile yet."
        />
      ) : null}

      {statement ? (
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Received units"
            value={statement.summary.receivedUnits.toLocaleString('en-IN')}
            icon={ArrowDownToLine}
            tone="success"
          />
          <StatTile
            label="Issued units"
            value={statement.summary.issuedUnits.toLocaleString('en-IN')}
            icon={ArrowUpFromLine}
            tone="primary"
          />
          <StatTile
            label="Write-off + sold"
            value={(
              statement.summary.writeOffUnits + statement.summary.soldUnits
            ).toLocaleString('en-IN')}
            icon={X}
            tone="warning"
          />
          <StatTile
            label="Mismatches"
            value={statement.summary.mismatches}
            icon={BadgeCheck}
            tone={statement.summary.mismatches > 0 ? 'danger' : 'success'}
            hint={
              statement.to >= statement.balancesAsOf
                ? 'Closing vs live stock balance'
                : 'Past period — live balances not comparable'
            }
          />
        </div>
      ) : null}

      <Card>
        <DataTable
          columns={[
            'Medicine / Batch',
            'Opening',
            'Received',
            'Issued',
            'Write-off',
            'Sold',
            'Closing',
            'Current',
            'Match',
          ]}
          loading={statementQuery.isLoading}
          empty={
            !statementQuery.isLoading && flatRows.length === 0 ? (
              <EmptyState
                title="Nothing moved in this period"
                description="No ledger activity or stock balance for this month and filter."
              />
            ) : null
          }
        >
          {flatRows.map((row) => (
            <tr
              key={`${row.medicine.id}-${row.batch.id}`}
              className="border-b border-[var(--color-border)] last:border-0"
            >
              <Td>
                <span className="font-medium">{row.medicine.name}</span>
                <span className="mt-0.5 block text-xs text-[var(--color-muted)]">
                  Batch {row.batch.batchNo}
                  {row.batch.expiryDate ? ` · exp ${row.batch.expiryDate}` : ''}
                </span>
              </Td>
              <Td>{row.opening}</Td>
              <Td className="text-[var(--color-success)]">{row.received}</Td>
              <Td>{row.issued}</Td>
              <Td>{row.writeOff}</Td>
              <Td>{row.sold}</Td>
              <Td className="font-semibold">{row.closing}</Td>
              <Td>{row.currentBalance}</Td>
              <Td>
                {row.matches === null ? (
                  <Badge tone="neutral">n/a</Badge>
                ) : row.matches ? (
                  <Badge tone="success">✓ match</Badge>
                ) : (
                  <Badge tone="danger">✗ off</Badge>
                )}
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
