import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Lock, Trash2, Warehouse } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, Textarea } from '@/components/ui/Field';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { medicinesApi } from '@/services/medicines.service';
import { stockistStatementsApi, type Statement, type StatementLine } from '@/services/stockist-statements.service';
import { useAuth } from '@/store/AuthContext';
import { downloadCsv } from '@/utils/exportReport';
import { currentMonthKey, monthLabel, shiftMonth } from '@/utils/month';
import { cn } from '@/utils/cn';

type View = 'monthly' | 'quarterly' | 'yearly';
const STATUS_TONE = { MISSING: 'danger', NEW: 'neutral', DRAFT: 'warning', SUBMITTED: 'success' } as const;
const STATUS_LABEL = { MISSING: 'Not started', NEW: 'Not started', DRAFT: 'Draft', SUBMITTED: 'Submitted' } as const;
const money = (n: number | null | undefined) => (n == null ? '—' : `₹${Math.round(n).toLocaleString('en-IN')}`);

/** Financial year (April–March) the given month belongs to, e.g. 2026-11 → 2026. */
function fyOf(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return m! >= 4 ? y! : y! - 1;
}

/**
 * Stockist Statement (client note): the MR enters each stockist's monthly statement —
 * opening, receipt, sales, returns / expiry, closing — and sees quarterly and yearly
 * figures calculated from the months (financial year, April–March).
 */
export function StockistStatementPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('view');
  const view: View = requested === 'quarterly' || requested === 'yearly' ? requested : 'monthly';
  return (
    <div className="space-y-5">
      <PageHeader title="Stockist Statement" description="Monthly stock statement per stockist; quarterly and yearly are worked out from the months." />
      <Tabs
        variant="page"
        ariaLabel="Statement period"
        items={[
          { value: 'monthly', label: 'Monthly', icon: CalendarDays },
          { value: 'quarterly', label: 'Quarterly', icon: CalendarRange },
          { value: 'yearly', label: 'Yearly', icon: FileSpreadsheet },
        ]}
        value={view}
        onChange={(next) => setParams(next === 'monthly' ? {} : { view: next })}
      />
      {view === 'monthly' ? <Monthly /> : <Summary period={view === 'quarterly' ? 'quarter' : 'year'} />}
    </div>
  );
}

// ── Monthly ──────────────────────────────────────────────────────────────

function Monthly() {
  const [month, setMonth] = useState(currentMonthKey());
  const [storeId, setStoreId] = useState<number | null>(null);
  const overview = useQuery({ queryKey: ['statements', 'overview', month], queryFn: () => stockistStatementsApi.overview(month) });
  const thisMonth = currentMonthKey();

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => { setMonth((m) => shiftMonth(m, -1)); setStoreId(null); }}>
            <ChevronLeft size={16} />
          </Button>
          <span className="min-w-36 text-center text-sm font-semibold text-[var(--color-ink)]" data-testid="statement-month">{monthLabel(month)}</span>
          <Button variant="ghost" size="sm" aria-label="Next month" disabled={month >= thisMonth} onClick={() => { setMonth((m) => shiftMonth(m, 1)); setStoreId(null); }}>
            <ChevronRight size={16} />
          </Button>
        </div>
        <p className="text-xs text-[var(--color-muted)]">Pick a stockist to fill or open its statement.</p>
      </Card>
      {overview.isError ? <Alert message={getApiErrorMessage(overview.error)} /> : null}
      {!overview.isLoading && (overview.data ?? []).length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No stockists in your list" description="Stockists are assigned to you by your Manager or Admin." />
        </Card>
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="statement-stockists">
        {(overview.data ?? []).map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => setStoreId(s.id)}
              className={cn(
                'flex w-full items-start justify-between gap-3 rounded-2xl border bg-[var(--color-surface)] p-4 text-left transition-colors hover:border-[var(--color-primary)]/50',
                storeId === s.id ? 'border-[var(--color-primary)]' : 'border-[var(--color-border)]',
              )}
            >
              <span className="flex min-w-0 items-start gap-3">
                <Warehouse size={18} className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-[var(--color-ink)]">{s.name}</span>
                  <span className="block text-xs text-[var(--color-muted)]">{[s.city, s.mr?.fullName].filter(Boolean).join(' · ')}</span>
                </span>
              </span>
              <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
            </button>
          </li>
        ))}
      </ul>
      {storeId ? <Editor key={`${storeId}-${month}`} storeId={storeId} month={month} /> : null}
    </div>
  );
}

type Row = Pick<StatementLine, 'medicineId' | 'name' | 'opening' | 'receipt' | 'sales' | 'returns' | 'rate'>;

function Editor({ storeId, month }: { storeId: number; month: string }) {
  const statement = useQuery({ queryKey: ['statements', storeId, month], queryFn: () => stockistStatementsApi.get(storeId, month) });
  if (statement.isLoading) return <Card className="p-6 text-sm text-[var(--color-muted)]">Loading statement…</Card>;
  if (statement.isError) return <Alert message={getApiErrorMessage(statement.error)} />;
  return <EditorForm statement={statement.data!} />;
}

function EditorForm({ statement }: { statement: Statement }) {
  const { role } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => statement.lines.map(({ medicineId, name, opening, receipt, sales, returns, rate }) => ({ medicineId, name, opening, receipt, sales, returns, rate })));
  const [remarks, setRemarks] = useState(statement.remarks ?? '');
  const [reason, setReason] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const locked = statement.status === 'SUBMITTED' && !statement.can.correct;
  const correcting = statement.status === 'SUBMITTED' && statement.can.correct;
  const openingLocked = statement.openingFromPrevious;

  const medicines = useQuery({ queryKey: ['medicines'], queryFn: () => medicinesApi.list(), staleTime: 300_000 });
  const options = useMemo(
    () => (medicines.data ?? []).filter((m) => !rows.some((r) => r.medicineId === m.id)).map((m) => ({ value: String(m.id), label: m.name })),
    [medicines.data, rows],
  );
  const closing = (r: Row) => r.opening + r.receipt - r.sales - r.returns;
  const negative = rows.filter((r) => closing(r) < 0);
  const update = (id: number, key: 'opening' | 'receipt' | 'sales' | 'returns', value: string) =>
    setRows((list) => list.map((r) => (r.medicineId === id ? { ...r, [key]: Math.max(0, Math.floor(Number(value) || 0)) } : r)));

  const save = useMutation({
    mutationFn: (submit: boolean) =>
      stockistStatementsApi.save({
        storeId: statement.store.id,
        month: statement.month,
        lines: rows.map((r) => ({ medicineId: r.medicineId, ...(openingLocked ? {} : { opening: r.opening }), receipt: r.receipt, sales: r.sales, returns: r.returns })),
        remarks: remarks.trim() || undefined,
        submit,
        ...(correcting ? { reason: reason.trim() } : {}),
      }),
    onSuccess: async (saved) => {
      setConfirmSubmit(false);
      toast.success(correcting ? 'Statement corrected' : saved.status === 'SUBMITTED' ? 'Statement submitted' : 'Draft saved');
      await queryClient.invalidateQueries({ queryKey: ['statements'] });
    },
    onError: () => setConfirmSubmit(false),
  });

  const totals = rows.reduce(
    (t, r) => ({ sales: t.sales + r.sales * (r.rate ?? 0), closing: t.closing + Math.max(0, closing(r)) * (r.rate ?? 0) }),
    { sales: 0, closing: 0 },
  );
  const cell = 'h-9 w-20 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-right text-[13px] tabular-nums outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--color-bg)] disabled:text-[var(--color-muted)]';

  return (
    <Card className="space-y-4 p-4" data-testid="statement-editor">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-[var(--color-ink)]">
            {statement.store.name} · {monthLabel(statement.month)}
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            {openingLocked ? `Opening = ${monthLabel(statement.previousMonth!.month)} closing.` : 'First month — type the opening stock.'}
            {statement.mr ? ` · ${statement.mr.fullName}` : ''}
          </p>
        </div>
        <Badge tone={STATUS_TONE[statement.status]}>{STATUS_LABEL[statement.status]}</Badge>
      </div>
      {locked ? (
        <p className="flex items-center gap-2 rounded-xl bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-muted)]">
          <Lock size={13} /> Submitted — {role === 'MR' ? 'ask your manager if something needs correcting.' : 'read only.'}
        </p>
      ) : null}
      {save.isError ? <Alert message={getApiErrorMessage(save.error)} /> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]" data-testid="statement-table">
          <thead className="border-b border-[var(--color-border)] text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
            <tr>
              <th className="px-2 py-2 text-left">Product</th>
              <th className="px-2 py-2 text-right">Opening</th>
              <th className="px-2 py-2 text-right">Receipt</th>
              <th className="px-2 py-2 text-right">Sales</th>
              <th className="px-2 py-2 text-right">Returns / expiry</th>
              <th className="px-2 py-2 text-right">Closing</th>
              <th className="px-2 py-2 text-right">Value (PTS)</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const c = closing(r);
              return (
                <tr key={r.medicineId} className="border-b border-[var(--color-border)] last:border-0" data-testid="statement-row">
                  <td className="px-2 py-2 font-medium text-[var(--color-ink)]">{r.name}</td>
                  {(['opening', 'receipt', 'sales', 'returns'] as const).map((key) => (
                    <td key={key} className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min={0}
                        inputMode="numeric"
                        aria-label={`${r.name} ${key}`}
                        className={cell}
                        value={r[key]}
                        disabled={locked || (key === 'opening' && openingLocked)}
                        onChange={(e) => update(r.medicineId, key, e.target.value)}
                      />
                    </td>
                  ))}
                  <td className={cn('px-2 py-2 text-right font-semibold tabular-nums', c < 0 ? 'text-[var(--color-danger)]' : 'text-[var(--color-ink)]')} data-testid="statement-closing">
                    {c}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-[var(--color-muted)]">{r.rate != null ? money(Math.max(0, c) * r.rate) : '—'}</td>
                  <td className="px-2 py-2 text-right">
                    {!locked && !openingLocked ? (
                      <Button variant="ghost" size="icon-sm" aria-label={`Remove ${r.name}`} onClick={() => setRows((list) => list.filter((x) => x.medicineId !== r.medicineId))}>
                        <Trash2 size={14} />
                      </Button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length ? (
            <tfoot>
              <tr className="text-[12px] text-[var(--color-muted)]">
                <td className="px-2 py-2" colSpan={6}>
                  {rows.some((r) => r.rate != null) ? `Sales value ${money(totals.sales)}` : 'Values appear once the products have a PTS (Products page).'}
                </td>
                <td className="px-2 py-2 text-right font-semibold text-[var(--color-ink)]">{rows.some((r) => r.rate != null) ? money(totals.closing) : '—'}</td>
                <td />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
      {rows.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No products yet — add the ones this stockist holds.</p> : null}
      {negative.length ? (
        <Alert message={`${negative.map((r) => r.name).join(', ')}: sales + returns are more than opening + receipt.`} />
      ) : null}

      {!locked ? (
        <div className="grid gap-3 md:grid-cols-2">
          <SearchableSelect
            label="Add a product"
            value=""
            options={options}
            placeholder="Choose a product…"
            onChange={(value) => {
              const m = medicines.data?.find((x) => String(x.id) === value);
              if (m) setRows((list) => [...list, { medicineId: m.id, name: m.name, opening: 0, receipt: 0, sales: 0, returns: 0, rate: m.pts != null ? Number(m.pts) : null }]);
            }}
          />
          <Textarea label="Remarks" optional rows={2} maxLength={1000} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          {correcting ? (
            <Textarea label="Reason for the correction" required rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} hint="Kept in the history with the old and new figures." />
          ) : null}
        </div>
      ) : null}

      {!locked ? (
        <div className="flex flex-wrap justify-end gap-2">
          {correcting ? (
            <Button onClick={() => save.mutate(true)} disabled={negative.length > 0 || reason.trim().length < 5} loading={save.isPending}>
              Save correction
            </Button>
          ) : (
            <>
              <Button variant="secondary" onClick={() => save.mutate(false)} disabled={negative.length > 0 || rows.length === 0} loading={save.isPending && !confirmSubmit}>
                Save draft
              </Button>
              <Button onClick={() => setConfirmSubmit(true)} disabled={negative.length > 0 || rows.length === 0}>
                Submit
              </Button>
            </>
          )}
        </div>
      ) : null}
      <ConfirmDialog
        open={confirmSubmit}
        variant="generic"
        badge="Submit"
        title={`Submit ${statement.store.name} · ${monthLabel(statement.month)}?`}
        description="After submitting only your manager can correct it. Next month opens with these closing figures."
        confirmLabel="Submit statement"
        loading={save.isPending}
        onConfirm={() => save.mutate(true)}
        onClose={() => setConfirmSubmit(false)}
      />
    </Card>
  );
}

// ── Quarterly / yearly ───────────────────────────────────────────────────

function Summary({ period }: { period: 'quarter' | 'year' }) {
  const thisFy = fyOf(currentMonthKey());
  const [storeId, setStoreId] = useState('');
  const [year, setYear] = useState(thisFy);
  const [quarter, setQuarter] = useState(() => {
    const m = Number(currentMonthKey().slice(5));
    return m >= 4 ? Math.ceil((m - 3) / 3) : 4;
  });
  const stockists = useQuery({ queryKey: ['statements', 'stockists'], queryFn: () => stockistStatementsApi.stockists() });
  const chosen = storeId ? Number(storeId) : (stockists.data?.[0]?.id ?? null);
  const summary = useQuery({
    queryKey: ['statements', 'summary', chosen, period, year, quarter],
    queryFn: () => stockistStatementsApi.summary({ storeId: chosen!, period, year, ...(period === 'quarter' ? { quarter } : {}) }),
    enabled: chosen != null,
  });
  const s = summary.data;

  return (
    <div className="space-y-4">
      <Card className="grid gap-3 p-4 md:grid-cols-3">
        <Select label="Stockist" value={chosen ? String(chosen) : ''} onChange={(e) => setStoreId(e.target.value)}>
          {(stockists.data ?? []).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
        <Select label="Financial year" value={String(year)} onChange={(e) => setYear(Number(e.target.value))}>
          {[thisFy, thisFy - 1, thisFy - 2].map((y) => (
            <option key={y} value={y}>
              FY {y}-{String((y + 1) % 100).padStart(2, '0')} (Apr–Mar)
            </option>
          ))}
        </Select>
        {period === 'quarter' ? (
          <Select label="Quarter" value={String(quarter)} onChange={(e) => setQuarter(Number(e.target.value))}>
            {['Q1 · Apr–Jun', 'Q2 · Jul–Sep', 'Q3 · Oct–Dec', 'Q4 · Jan–Mar'].map((label, i) => (
              <option key={label} value={i + 1}>
                {label}
              </option>
            ))}
          </Select>
        ) : null}
      </Card>
      {!stockists.isLoading && (stockists.data ?? []).length === 0 ? (
        <Card className="p-6">
          <EmptyState title="No stockists in your list" description="Stockists are assigned to you by your Manager or Admin." />
        </Card>
      ) : null}
      {summary.isError ? <Alert message={getApiErrorMessage(summary.error)} /> : null}
      {s ? (
        <Card className="space-y-3 p-4" data-testid="statement-summary">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[15px] font-semibold text-[var(--color-ink)]">
              {s.store.name} · {s.label}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                downloadCsv(
                  `stockist-statement-${s.store.name}-${s.label}`.replace(/[^a-z0-9-]+/gi, '-'),
                  s.rows.map((r) => ({ product: r.name, opening: r.opening, receipt: r.receipt, sales: r.sales, returns: r.returns, closing: r.closing, salesValue: r.salesValue, closingValue: r.closingValue })),
                  { stockist: s.store.name, period: s.label, salesValue: s.totals.salesValue, closingValue: s.totals.closingValue },
                )
              }
            >
              <Download size={14} /> CSV
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {s.months.map((m) => (
              <Badge key={m.month} tone={STATUS_TONE[m.status]} dot={false}>
                {monthLabel(m.month)} · {STATUS_LABEL[m.status]}
              </Badge>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[13px]">
              <thead className="border-b border-[var(--color-border)] text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                <tr>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-right">Opening</th>
                  <th className="px-2 py-2 text-right">Receipt</th>
                  <th className="px-2 py-2 text-right">Sales</th>
                  <th className="px-2 py-2 text-right">Returns</th>
                  <th className="px-2 py-2 text-right">Closing</th>
                  <th className="px-2 py-2 text-right">Sales value</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => (
                  <tr key={r.medicineId} className="border-b border-[var(--color-border)] last:border-0 tabular-nums" data-testid="summary-row">
                    <td className="px-2 py-2 font-medium text-[var(--color-ink)]">{r.name}</td>
                    <td className="px-2 py-2 text-right">{r.opening}</td>
                    <td className="px-2 py-2 text-right">{r.receipt}</td>
                    <td className="px-2 py-2 text-right">{r.sales}</td>
                    <td className="px-2 py-2 text-right">{r.returns}</td>
                    <td className="px-2 py-2 text-right font-semibold">{r.closing}</td>
                    <td className="px-2 py-2 text-right">{money(r.salesValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {s.rows.length === 0 ? <p className="text-sm text-[var(--color-muted)]">No statements in this period yet.</p> : null}
          <p className="text-xs text-[var(--color-muted)]">
            {s.rows.some((r) => r.rate != null)
              ? `Sales value ${money(s.totals.salesValue)} · closing stock value ${money(s.totals.closingValue)}`
              : 'Values appear once the products have a PTS (Products page).'}
          </p>
        </Card>
      ) : null}
    </div>
  );
}
