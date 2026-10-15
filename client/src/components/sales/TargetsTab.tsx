import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Target, Trash2, TrendingUp } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Input } from '@/components/ui/Field';
import { Meter } from '@/components/ui/Meter';
import { Modal } from '@/components/ui/Modal';
import { Alert, Card, CardHeader, EmptyState, StatTile } from '@/components/ui/Page';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { employeesApi } from '@/services/employees.service';
import { medicinesApi } from '@/services/medicines.service';
import { targetsApi, type UpsertTargetPayload } from '@/services/targets.service';
import { formatINR, formatINRCompact } from '@/utils/currency';
import { toIsoDate } from '@/utils/datetime';

function currentMonth(): string {
  return toIsoDate(new Date()).slice(0, 7);
}

function meterColor(pct: number | null): string {
  if (pct === null) return 'var(--color-border-strong)';
  if (pct >= 100) return 'var(--color-success)';
  if (pct >= 60) return 'var(--color-primary)';
  return 'var(--color-warning)';
}

export function TargetsTab() {
  const { can, user } = useAuth();
  const canManageTargets = can('targets:manage');
  const [month, setMonth] = useState(currentMonth());

  return canManageTargets ? (
    <ManagerTargets month={month} onMonthChange={setMonth} />
  ) : (
    <MyProgress month={month} onMonthChange={setMonth} userId={user?.id} />
  );
}

/** MR view — own target vs booked sales for the month. */
function MyProgress({
  month,
  onMonthChange,
  userId,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  userId?: number;
}) {
  const progressQuery = useQuery({
    queryKey: ['targets', 'progress', month, userId],
    queryFn: () => targetsApi.progress({ month, ...(userId ? { userId } : {}) }),
  });
  const row = progressQuery.data?.rows[0];

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <Input
          label="Month"
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value || currentMonth())}
          className="w-44"
        />
      </div>
      {progressQuery.isError ? <Alert message={getApiErrorMessage(progressQuery.error)} /> : null}
      <Card className="p-5">
        {progressQuery.isLoading ? (
          <p className="py-6 text-center text-sm text-[var(--color-muted)]">Loading progress…</p>
        ) : row ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                  My target · {month}
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-[var(--color-ink)]">
                  {row.targetAmount > 0 ? formatINR(row.targetAmount) : 'No target set'}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                <Target size={18} />
              </span>
            </div>
            <Meter
              value={row.achievedAmount}
              total={row.targetAmount}
              color={meterColor(row.pct)}
              className="h-2.5"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-[var(--color-muted)]">
                Achieved{' '}
                <span className="font-bold text-[var(--color-ink)] tabular-nums">
                  {formatINR(row.achievedAmount)}
                </span>
              </span>
              <span className="font-bold tabular-nums" style={{ color: meterColor(row.pct) }}>
                {row.pct === null ? '—' : `${row.pct.toFixed(0)}%`}
              </span>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No progress data"
            description="Your manager has not set a target for this month yet — booked sales still count."
          />
        )}
      </Card>
    </div>
  );
}

/** Manager / admin view — team table with upsert + delete. */
function ManagerTargets({
  month,
  onMonthChange,
}: {
  month: string;
  onMonthChange: (month: string) => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogUserId, setDialogUserId] = useState('');
  const [dialogAmount, setDialogAmount] = useState('');
  const [dialogUnits, setDialogUnits] = useState('');
  const [dialogMedicineId, setDialogMedicineId] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [targetToDelete, setTargetToDelete] = useState<number | null>(null);

  const progressQuery = useQuery({
    queryKey: ['targets', 'progress', month],
    queryFn: () => targetsApi.progress({ month }),
  });
  const targetsQuery = useQuery({
    queryKey: ['targets', 'list', month],
    queryFn: () => targetsApi.list({ month }),
  });
  const employeesQuery = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeesApi.list(),
    enabled: dialogOpen,
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
    enabled: dialogOpen,
  });

  const rows = progressQuery.data?.rows ?? [];
  const totals = progressQuery.data?.totals;

  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data ?? [])
        .filter((employee) => employee.role !== 'ADMIN')
        .map((employee) => ({
          value: String(employee.id),
          label: employee.fullName,
          meta: [employee.employeeCode, employee.role].filter(Boolean).join(' · ') || undefined,
        })),
    [employeesQuery.data],
  );
  const medicineOptions = useMemo(
    () =>
      (medicinesQuery.data ?? []).map((medicine) => ({
        value: String(medicine.id),
        label: medicine.name,
        meta: medicine.company ?? undefined,
      })),
    [medicinesQuery.data],
  );

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['targets'] });
  }

  const upsertMutation = useMutation({
    mutationFn: (payload: UpsertTargetPayload) => targetsApi.upsert(payload),
    onSuccess: async () => {
      toast.success('Target saved');
      setDialogOpen(false);
      await refresh();
    },
    onError: (err) => setDialogError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => targetsApi.remove(id),
    onSuccess: async () => {
      toast.success('Target removed');
      setTargetToDelete(null);
      await refresh();
    },
    onError: (err) => {
      setTargetToDelete(null);
      toast.error('Could not remove target', getApiErrorMessage(err));
    },
  });

  function openDialog(userId?: number, amount?: number) {
    setDialogUserId(userId ? String(userId) : '');
    setDialogAmount(amount && amount > 0 ? String(amount) : '');
    setDialogUnits('');
    setDialogMedicineId('');
    setDialogError(null);
    setDialogOpen(true);
  }

  function onSubmitDialog(event: FormEvent) {
    event.preventDefault();
    setDialogError(null);
    if (!dialogUserId) {
      setDialogError('Select the employee');
      return;
    }
    const amount = Number(dialogAmount);
    if (!(amount >= 0) || dialogAmount === '') {
      setDialogError('Enter a target amount (₹)');
      return;
    }
    upsertMutation.mutate({
      userId: Number(dialogUserId),
      targetMonth: month,
      targetAmount: amount,
      ...(dialogMedicineId ? { medicineId: Number(dialogMedicineId) } : {}),
      ...(dialogUnits ? { targetUnits: Number(dialogUnits) } : {}),
    });
  }

  const monthTargets = targetsQuery.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Input
          label="Month"
          type="month"
          value={month}
          onChange={(e) => onMonthChange(e.target.value || currentMonth())}
          className="w-44"
        />
        <Button onClick={() => openDialog()}>
          <Plus size={16} /> Set target
        </Button>
      </div>

      {progressQuery.isError ? <Alert message={getApiErrorMessage(progressQuery.error)} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Team target"
          value={formatINRCompact(totals?.targetAmount ?? 0)}
          icon={Target}
          tone="primary"
        />
        <StatTile
          label="Achieved"
          value={formatINRCompact(totals?.achievedAmount ?? 0)}
          icon={TrendingUp}
          tone="success"
        />
        <StatTile
          label="Achievement"
          value={totals?.pct === null || totals === undefined ? '—' : `${totals.pct.toFixed(0)}%`}
          tone={totals?.pct !== null && (totals?.pct ?? 0) >= 100 ? 'success' : 'warning'}
        />
      </div>

      <Card>
        <CardHeader title={`Target vs achieved · ${month}`} description="Overall monthly targets per employee" />
        <DataTable
          columns={[
            { key: 'name', label: 'Employee' },
            { key: 'target', label: 'Target' },
            { key: 'achieved', label: 'Achieved' },
            { key: 'progress', label: 'Progress', className: 'w-56' },
            { key: 'actions', label: '' },
          ]}
          loading={progressQuery.isLoading}
          empty={
            !progressQuery.isLoading && rows.length === 0 ? (
              <EmptyState title="Nobody in scope" description="No team members found for this month." />
            ) : null
          }
        >
          {rows.map((row) => (
            <tr key={row.userId} className="border-b border-[var(--color-border)] last:border-0">
              <Td className="font-medium">
                {row.fullName}
                <span className="ml-2 text-[10px] font-semibold text-[var(--color-muted)] uppercase">
                  {row.role}
                </span>
              </Td>
              <Td>{row.targetAmount > 0 ? formatINR(row.targetAmount) : '—'}</Td>
              <Td>{formatINR(row.achievedAmount)}</Td>
              <Td>
                <div className="flex items-center gap-2">
                  <Meter
                    value={row.achievedAmount}
                    total={row.targetAmount}
                    color={meterColor(row.pct)}
                    className="w-32"
                  />
                  <span
                    className="text-xs font-bold tabular-nums"
                    style={{ color: meterColor(row.pct) }}
                  >
                    {row.pct === null ? '—' : `${row.pct.toFixed(0)}%`}
                  </span>
                </div>
              </Td>
              <Td>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDialog(row.userId, row.targetAmount)}
                  >
                    Set target
                  </Button>
                  {row.targetId !== null ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove target"
                      onClick={() => setTargetToDelete(row.targetId)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  ) : null}
                </div>
              </Td>
            </tr>
          ))}
        </DataTable>
      </Card>

      {monthTargets.some((target) => target.medicineId !== null) ? (
        <Card>
          <CardHeader
            title="Medicine-wise targets"
            description="Product-specific targets set for this month"
          />
          <DataTable columns={['Employee', 'Medicine', 'Target ₹', 'Units', '']}>
            {monthTargets
              .filter((target) => target.medicineId !== null)
              .map((target) => (
                <tr key={target.id} className="border-b border-[var(--color-border)] last:border-0">
                  <Td className="font-medium">{target.user?.fullName ?? `#${target.userId}`}</Td>
                  <Td>{target.medicine?.name ?? `#${target.medicineId}`}</Td>
                  <Td>{formatINR(target.targetAmount)}</Td>
                  <Td>{target.targetUnits ?? '—'}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove target"
                        onClick={() => setTargetToDelete(target.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
          </DataTable>
        </Card>
      ) : null}

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Set sales target"
        description={`Target month: ${month} — saving again overwrites the existing figure.`}
        icon={Target}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="target-form" disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? 'Saving…' : 'Save Target'}
            </Button>
          </>
        }
      >
        <form id="target-form" className="space-y-3" onSubmit={onSubmitDialog}>
          {dialogError ? <Alert message={dialogError} /> : null}
          <SearchableSelect
            label="Employee"
            required
            value={dialogUserId}
            onChange={setDialogUserId}
            options={employeeOptions}
            placeholder="Select employee…"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Target amount ₹"
              type="number"
              min={0}
              step="0.01"
              required
              value={dialogAmount}
              onChange={(e) => setDialogAmount(e.target.value)}
            />
            <Input
              label="Target units"
              type="number"
              min={0}
              optional
              value={dialogUnits}
              onChange={(e) => setDialogUnits(e.target.value)}
            />
          </div>
          <SearchableSelect
            label="Medicine (optional — leave empty for overall target)"
            value={dialogMedicineId}
            onChange={setDialogMedicineId}
            options={medicineOptions}
            placeholder="Overall monthly target"
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={targetToDelete !== null}
        title="Remove this target?"
        description="The employee will show as having no target for the month."
        confirmLabel="Remove target"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (targetToDelete !== null) deleteMutation.mutate(targetToDelete);
        }}
        onClose={() => setTargetToDelete(null)}
      />
    </div>
  );
}
