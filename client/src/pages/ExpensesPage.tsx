import { useMemo, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  BadgeIndianRupee,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Paperclip,
  PencilLine,
  Plus,
  Trash2,
  Upload,
  User,
  Users,
  Wallet,
  XCircle,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TableToolbar, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Modal, FormSection } from '@/components/ui/Modal';
import {
  Alert,
  Badge,
  Card,
  DetailRow,
  EmptyState,
  PageHeader,
  StatTile,
} from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useClientTable } from '@/hooks/useClientTable';
import { useAuth } from '@/store/AuthContext';
import {
  EXPENSE_CATEGORY_LABEL,
  EXPENSE_STATUS_TONE,
  expensesApi,
  formatInr,
  type ExpenseCategory,
  type ExpenseClaim,
  type ExpenseStatus,
} from '@/services/expenses.service';
import { filesApi, openStoredFile } from '@/services/files.service';
import { formatDisplayDate, toIsoDate } from '@/utils/datetime';
import { currentMonthKey, monthLabel, shiftMonth } from '@/utils/month';

type TabValue = 'mine' | 'team';

const emptyForm = {
  expenseDate: toIsoDate(new Date()),
  category: 'TRAVEL' as ExpenseCategory,
  amount: '',
  distanceKm: '',
  description: '',
};

export function ExpensesPage() {
  const { user, can } = useAuth();
  const canOwn = can('expenses:own');
  const canManage = can('expenses:manage');
  const isAdmin = user?.role === 'ADMIN';
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState<TabValue>(canOwn ? 'mine' : 'team');
  const [month, setMonth] = useState(currentMonthKey());
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseClaim | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [receipt, setReceipt] = useState<{ key: string; fileName: string } | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseClaim | null>(null);
  const [decision, setDecision] = useState<{
    row: ExpenseClaim;
    status: 'APPROVED' | 'REJECTED';
  } | null>(null);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  const myClaimsQuery = useQuery({
    queryKey: ['expenses', 'mine', user?.id, month],
    queryFn: () => expensesApi.list({ month, userId: user?.id }),
    enabled: canOwn && Boolean(user?.id),
  });
  const teamClaimsQuery = useQuery({
    queryKey: ['expenses', 'team', month, statusFilter],
    queryFn: () =>
      expensesApi.list({ month, status: statusFilter || undefined }),
    enabled: canManage && tab === 'team',
  });

  const myClaims = myClaimsQuery.data ?? [];
  const teamClaims = teamClaimsQuery.data ?? [];
  const activeRows = tab === 'mine' ? myClaims : teamClaims;

  const totals = useMemo(() => {
    const source = canOwn ? myClaims : teamClaims;
    const sum = (statuses: ExpenseStatus[]) =>
      source
        .filter((row) => statuses.includes(row.status))
        .reduce((total, row) => total + row.amount, 0);
    return {
      claimed: sum(['PENDING', 'APPROVED', 'PAID']),
      approved: sum(['APPROVED']),
      paid: sum(['PAID']),
    };
  }, [canOwn, myClaims, teamClaims]);

  const table = useClientTable({
    data: activeRows,
    getSearchText: (row) =>
      [
        row.employee?.fullName,
        row.category,
        row.description,
        row.status,
        row.expenseDate,
        String(row.amount),
      ]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'date') return row.expenseDate;
      if (key === 'employee') return row.employee?.fullName;
      if (key === 'category') return row.category;
      if (key === 'amount') return row.amount;
      if (key === 'status') return row.status;
      return undefined;
    },
    initialSortKey: 'date',
    initialSortDir: 'desc',
    pageSize: 20,
  });

  async function invalidate(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['expenses'] }),
      queryClient.invalidateQueries({ queryKey: ['notifications'] }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        expenseDate: form.expenseDate,
        category: form.category,
        amount: Number(form.amount),
        distanceKm: form.distanceKm ? Number(form.distanceKm) : undefined,
        description: form.description.trim(),
        receiptFileKey: receipt?.key,
      };
      return editing ? expensesApi.update(editing.id, payload) : expensesApi.create(payload);
    },
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setReceipt(null);
      setError(null);
      toast.success(editing ? 'Claim updated' : 'Expense claim submitted');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expensesApi.remove(id),
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success('Claim deleted');
      await invalidate();
    },
    onError: (err) => {
      setDeleteTarget(null);
      setError(getApiErrorMessage(err));
    },
  });

  const decideMutation = useMutation({
    mutationFn: (input: { id: number; status: 'APPROVED' | 'REJECTED'; remark?: string }) =>
      expensesApi.decide(input.id, { status: input.status, remark: input.remark }),
    onSuccess: async (row) => {
      setDecision(null);
      setRemark('');
      setError(null);
      toast.success(row.status === 'APPROVED' ? 'Expense approved' : 'Expense rejected');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => expensesApi.markPaid(id),
    onSuccess: async () => {
      setError(null);
      toast.success('Marked paid', 'The employee has been notified.');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openCreate(): void {
    setEditing(null);
    setForm(emptyForm);
    setReceipt(null);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(row: ExpenseClaim): void {
    setEditing(row);
    setForm({
      expenseDate: row.expenseDate,
      category: row.category,
      amount: String(row.amount),
      distanceKm: row.distanceKm !== null ? String(row.distanceKm) : '',
      description: row.description,
    });
    setReceipt(row.receiptFileKey ? { key: row.receiptFileKey, fileName: 'Receipt' } : null);
    setError(null);
    setFormOpen(true);
  }

  async function onPickReceipt(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const info = await filesApi.upload(file, 'expense-receipt');
      setReceipt({ key: info.key, fileName: info.fileName });
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Upload failed'));
    } finally {
      setUploadingReceipt(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) {
      setError('Enter the claimed amount');
      return;
    }
    saveMutation.mutate();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses (TA/DA)"
        description="File travel and daily-allowance claims with receipts; managers approve and admin settles the payout."
        actions={
          canOwn ? (
            <Button size="lg" onClick={openCreate}>
              <Plus size={15} />
              New claim
            </Button>
          ) : null
        }
      />

      {error && !formOpen && !decision ? <Alert message={error} /> : null}

      {/* ── This-month figures ───────────────────────────────────────────── */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Claimed this month"
          value={formatInr(totals.claimed)}
          hint={monthLabel(month)}
          icon={Wallet}
        />
        <StatTile
          label="Approved"
          value={formatInr(totals.approved)}
          hint="Awaiting payout"
          icon={BadgeCheck}
          tone="primary"
        />
        <StatTile
          label="Paid out"
          value={formatInr(totals.paid)}
          hint="Settled by admin"
          icon={BadgeIndianRupee}
          tone="success"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              ...(canOwn ? [{ value: 'mine' as TabValue, label: 'My claims', icon: User }] : []),
              ...(canManage
                ? [
                    {
                      value: 'team' as TabValue,
                      label: 'Team claims',
                      icon: Users,
                      count: teamClaims.filter(
                        (row) => row.status === 'PENDING' && row.userId !== user?.id,
                      ).length,
                    },
                  ]
                : []),
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            {tab === 'team' ? (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ExpenseStatus | '')}
                className="h-9 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-medium text-[var(--color-ink)] shadow-xs outline-none transition focus:border-[var(--color-primary)]"
              >
                <option value="">All statuses</option>
                {(['PENDING', 'APPROVED', 'PAID', 'REJECTED'] as ExpenseStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label="Previous month"
                onClick={() => setMonth((m) => shiftMonth(m, -1))}
              >
                <ChevronLeft size={14} />
              </Button>
              <span className="min-w-[8.5rem] text-center text-xs font-bold text-[var(--color-ink)]">
                {monthLabel(month)}
              </span>
              <Button
                size="icon-sm"
                variant="secondary"
                aria-label="Next month"
                onClick={() => setMonth((m) => shiftMonth(m, 1))}
              >
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        </div>

        <TableToolbar
          search={table.search}
          onSearchChange={table.setSearch}
          placeholder={tab === 'mine' ? 'Search my claims…' : 'Search team claims…'}
        />

        <DataTable
          loading={tab === 'mine' ? myClaimsQuery.isLoading : teamClaimsQuery.isLoading}
          columns={[
            { key: 'date', label: 'Date', sortable: true },
            ...(tab === 'team' ? [{ key: 'employee', label: 'Employee', sortable: true }] : []),
            { key: 'category', label: 'Category', sortable: true },
            { key: 'amount', label: 'Amount', sortable: true, className: 'text-right' },
            { key: 'description', label: 'Description' },
            { key: 'status', label: 'Status', sortable: true },
            { key: 'actions', label: '' },
          ]}
          sortKey={table.sortKey}
          sortDir={table.sortDir}
          onSort={table.toggleSort}
          empty={
            table.rows.length === 0 ? (
              <EmptyState
                title={tab === 'mine' ? 'No claims this month' : 'Nothing from the team'}
                description={
                  tab === 'mine'
                    ? 'File TA/DA for your field days — it lands in your manager’s inbox.'
                    : 'Team claims for this month appear here.'
                }
              />
            ) : null
          }
        >
          {table.rows.map((row) => {
            const isOwn = row.userId === user?.id;
            return (
              <tr key={row.id} className="transition-colors hover:bg-[var(--color-bg)]/60">
                <Td className="whitespace-nowrap font-semibold">
                  {formatDisplayDate(row.expenseDate)}
                </Td>
                {tab === 'team' ? (
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.employee?.fullName ?? '?'} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {row.employee?.fullName ?? '—'}
                        </p>
                        <p className="truncate text-[11px] text-[var(--color-muted)]">
                          {row.employee?.employeeCode ?? row.employee?.role}
                        </p>
                      </div>
                    </div>
                  </Td>
                ) : null}
                <Td>
                  <Badge tone="neutral" dot={false}>
                    {EXPENSE_CATEGORY_LABEL[row.category]}
                  </Badge>
                  {row.distanceKm ? (
                    <p className="mt-0.5 text-[11px] text-[var(--color-muted)]">
                      {row.distanceKm} km
                    </p>
                  ) : null}
                </Td>
                <Td className="text-right font-semibold tabular-nums">
                  {formatInr(row.amount)}
                </Td>
                <Td className="max-w-[220px]">
                  <span className="line-clamp-2 text-xs text-[var(--color-muted)]">
                    {row.description}
                  </span>
                  {row.receiptFileKey ? (
                    <button
                      type="button"
                      onClick={() => void openStoredFile(row.receiptFileKey!)}
                      className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded-full bg-[var(--color-primary-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-primary)] hover:opacity-80"
                    >
                      <Paperclip size={10} />
                      Receipt
                    </button>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={EXPENSE_STATUS_TONE[row.status]}>{row.status}</Badge>
                  {row.decisionRemark ? (
                    <p
                      className="mt-0.5 max-w-[160px] truncate text-[11px] text-[var(--color-muted)]"
                      title={row.decisionRemark}
                    >
                      {row.decisionRemark}
                    </p>
                  ) : null}
                </Td>
                <Td className="text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {isOwn && row.status === 'PENDING' ? (
                      <>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label="Edit claim"
                          onClick={() => openEdit(row)}
                        >
                          <PencilLine size={13} />
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="danger"
                          aria-label="Delete claim"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </>
                    ) : null}
                    {tab === 'team' && canManage && row.status === 'PENDING' && !isOwn ? (
                      <>
                        <Button
                          size="sm"
                          variant="soft"
                          onClick={() => {
                            setDecision({ row, status: 'APPROVED' });
                            setRemark('');
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setDecision({ row, status: 'REJECTED' });
                            setRemark('');
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    ) : null}
                    {tab === 'team' && isAdmin && row.status === 'APPROVED' ? (
                      <Button
                        size="sm"
                        loading={markPaidMutation.isPending}
                        onClick={() => markPaidMutation.mutate(row.id)}
                      >
                        <BadgeIndianRupee size={13} />
                        Mark paid
                      </Button>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </DataTable>
      </Card>

      {/* ── New / edit claim ─────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setError(null);
        }}
        title={editing ? 'Edit expense claim' : 'New expense claim'}
        description="Claims can be edited or deleted while they are pending."
        icon={Wallet}
        className="max-w-xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? <Alert message={error} /> : null}

          <FormSection title="Claim details" icon={ClipboardList}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Select
                label="Category"
                required
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as ExpenseCategory }))
                }
              >
                {(Object.keys(EXPENSE_CATEGORY_LABEL) as ExpenseCategory[]).map((category) => (
                  <option key={category} value={category}>
                    {EXPENSE_CATEGORY_LABEL[category]}
                  </option>
                ))}
              </Select>
              <DatePicker
                label="Expense date"
                required
                value={form.expenseDate}
                onChange={(value) => setForm((f) => ({ ...f, expenseDate: value }))}
              />
              <Input
                label="Amount (₹)"
                type="number"
                required
                min={1}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                placeholder="450"
              />
              <Input
                label="Distance (km)"
                type="number"
                optional
                min={0}
                step="0.1"
                value={form.distanceKm}
                onChange={(e) => setForm((f) => ({ ...f, distanceKm: e.target.value }))}
                hint="For travel claims"
              />
            </div>
            <Textarea
              label="Description"
              required
              className="mt-3.5"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Bike travel: HQ → Sikandra beat → HQ (34 km)"
            />
          </FormSection>

          <FormSection title="Receipt" icon={Paperclip}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={(e) => void onPickReceipt(e.target.files)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={uploadingReceipt}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} />
                {receipt ? 'Replace receipt' : 'Upload receipt'}
              </Button>
              {receipt ? (
                <span className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
                  <Paperclip size={11} />
                  <span className="truncate">{receipt.fileName}</span>
                  <button
                    type="button"
                    aria-label="Remove receipt"
                    className="cursor-pointer font-bold hover:opacity-70"
                    onClick={() => setReceipt(null)}
                  >
                    ×
                  </button>
                </span>
              ) : (
                <span className="text-[11px] text-[var(--color-muted)]">
                  JPEG / PNG / WebP / PDF, up to 5 MB
                </span>
              )}
            </div>
          </FormSection>

          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saveMutation.isPending}>
              {editing ? 'Save changes' : 'Submit claim'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Approve / reject ─────────────────────────────────────────────── */}
      <Modal
        open={Boolean(decision)}
        onClose={() => {
          setDecision(null);
          setRemark('');
        }}
        title={decision?.status === 'APPROVED' ? 'Approve expense' : 'Reject expense'}
        description={
          decision?.status === 'APPROVED'
            ? 'An administrator settles the payout after approval.'
            : 'The employee sees your remark on the claim.'
        }
        icon={decision?.status === 'APPROVED' ? BadgeCheck : XCircle}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setDecision(null);
                setRemark('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant={decision?.status === 'APPROVED' ? 'primary' : 'destructive'}
              loading={decideMutation.isPending}
              onClick={() =>
                decision &&
                decideMutation.mutate({
                  id: decision.row.id,
                  status: decision.status,
                  remark: remark.trim() || undefined,
                })
              }
            >
              {decision?.status === 'APPROVED' ? 'Approve' : 'Reject'}
            </Button>
          </>
        }
      >
        {error ? <Alert message={error} /> : null}
        {decision ? (
          <dl className="mb-3">
            <DetailRow label="Employee" value={decision.row.employee?.fullName} />
            <DetailRow label="Date" value={formatDisplayDate(decision.row.expenseDate)} />
            <DetailRow label="Category" value={EXPENSE_CATEGORY_LABEL[decision.row.category]} />
            <DetailRow label="Amount" value={formatInr(decision.row.amount)} />
            <DetailRow
              label="Distance"
              value={decision.row.distanceKm ? `${decision.row.distanceKm} km` : null}
            />
            <DetailRow label="Description" value={decision.row.description} />
          </dl>
        ) : null}
        <Textarea
          label="Remark"
          optional
          value={remark}
          onChange={(e) => setRemark(e.target.value)}
          placeholder="Approved as per the TA slab."
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete this claim"
        description={`${deleteTarget ? formatInr(deleteTarget.amount) : ''} · ${
          deleteTarget ? EXPENSE_CATEGORY_LABEL[deleteTarget.category] : ''
        } — a deleted claim cannot be restored.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
