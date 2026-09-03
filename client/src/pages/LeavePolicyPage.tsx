import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ScrollText, Settings2, SlidersHorizontal, Trash2, UserCog } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TableToolbar, Td } from '@/components/ui/DataTable';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Meter } from '@/components/ui/Meter';
import { Modal, FormSection } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader, StatTile } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useClientTable } from '@/hooks/useClientTable';
import { leavesApi, type LeaveType } from '@/services/leaves.service';
import { employeesApi } from '@/services/employees.service';

type TabValue = 'types' | 'entitlement';

const emptyType = {
  code: '',
  name: '',
  annualQuota: 12,
  isPaid: true,
  carryForward: false,
  maxCarryForward: 0,
  allowHalfDay: true,
  requiresProof: false,
  colorHex: '#0f766e',
  description: '',
  status: 'ACTIVE' as const,
};

export function LeavePolicyPage() {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState<TabValue>('types');
  const [year, setYear] = useState(new Date().getFullYear());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LeaveType | null>(null);
  const [form, setForm] = useState<typeof emptyType>(emptyType);
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [entitleTarget, setEntitleTarget] = useState<{
    userId: number;
    fullName: string;
  } | null>(null);
  const [entitleForm, setEntitleForm] = useState({ leaveTypeId: '', opening: 0, allocated: 0 });

  const typesQuery = useQuery({
    queryKey: ['leave-types', 'all'],
    queryFn: () => leavesApi.types(true),
  });
  const employeesQuery = useQuery({
    queryKey: ['employees', 'directory'],
    queryFn: () => employeesApi.list(),
    enabled: tab === 'entitlement',
  });
  const targetBalancesQuery = useQuery({
    queryKey: ['leave-balances', entitleTarget?.userId, year],
    queryFn: () => leavesApi.balances({ userId: entitleTarget?.userId, year }),
    enabled: Boolean(entitleTarget),
  });

  const types = typesQuery.data ?? [];

  const typeTable = useClientTable({
    data: types,
    searchKeys: ['code', 'name', 'description', 'status'],
    initialSortKey: 'code',
  });

  const employeeTable = useClientTable({
    data: employeesQuery.data ?? [],
    getSearchText: (row) =>
      [row.fullName, row.employeeCode, row.designation, row.role].filter(Boolean).join(' '),
    getSortValue: (row, key) => {
      if (key === 'name') return row.fullName;
      if (key === 'remaining') return row.leaveRemaining;
      return undefined;
    },
    initialSortKey: 'name',
    pageSize: 20,
  });

  async function invalidate(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['leave-types'] }),
      queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
      queryClient.invalidateQueries({ queryKey: ['employees'] }),
    ]);
  }

  const saveTypeMutation = useMutation({
    mutationFn: (payload: typeof emptyType) =>
      editing
        ? leavesApi.updateType(editing.id, payload)
        : leavesApi.createType(payload),
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      setForm(emptyType);
      setError(null);
      toast.success(editing ? 'Leave type updated' : 'Leave type created');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteTypeMutation = useMutation({
    mutationFn: (id: number) => leavesApi.removeType(id),
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success('Leave type removed');
      await invalidate();
    },
    onError: (err) => {
      setDeleteTarget(null);
      setError(getApiErrorMessage(err));
    },
  });

  const setBalanceMutation = useMutation({
    mutationFn: () =>
      leavesApi.setBalance({
        userId: entitleTarget!.userId,
        leaveTypeId: Number(entitleForm.leaveTypeId),
        year,
        opening: Number(entitleForm.opening),
        allocated: Number(entitleForm.allocated),
      }),
    onSuccess: async () => {
      setError(null);
      toast.success('Entitlement updated');
      await invalidate();
      await targetBalancesQuery.refetch();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openCreate(): void {
    setEditing(null);
    setForm(emptyType);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(type: LeaveType): void {
    setEditing(type);
    setForm({
      code: type.code,
      name: type.name,
      annualQuota: type.annualQuota,
      isPaid: type.isPaid,
      carryForward: type.carryForward,
      maxCarryForward: type.maxCarryForward,
      allowHalfDay: type.allowHalfDay,
      requiresProof: type.requiresProof,
      colorHex: type.colorHex,
      description: type.description ?? '',
      status: type.status as 'ACTIVE',
    });
    setError(null);
    setFormOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveTypeMutation.mutate(form);
  }

  const activeTypes = types.filter((type) => type.status === 'ACTIVE');
  const paidQuota = activeTypes
    .filter((type) => type.isPaid)
    .reduce((sum, type) => sum + type.annualQuota, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Leave policy"
        description="Leave categories, yearly quota and per-employee entitlement overrides."
        actions={
          tab === 'types' ? (
            <Button onClick={openCreate}>
              <Plus size={15} />
              New leave type
            </Button>
          ) : null
        }
      />

      {error && !formOpen ? <Alert message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Active leave types"
          value={activeTypes.length}
          icon={ScrollText}
          tone="primary"
        />
        <StatTile
          label="Paid days per year"
          value={paidQuota}
          hint="Default entitlement across paid types"
          icon={SlidersHorizontal}
        />
        <StatTile
          label="Carry-forward types"
          value={activeTypes.filter((type) => type.carryForward).length}
          icon={Settings2}
        />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'types', label: 'Leave types', icon: ScrollText },
              { value: 'entitlement', label: 'Per-employee entitlement', icon: UserCog },
            ]}
          />
          {tab === 'entitlement' ? (
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted)]">
              Year
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-9 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-xs font-medium shadow-xs outline-none focus:border-[var(--color-primary)]"
              >
                {[year - 1, year, year + 1]
                  .filter((value, index, self) => self.indexOf(value) === index)
                  .sort()
                  .map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}
        </div>

        {tab === 'types' ? (
          <>
            <TableToolbar
              search={typeTable.search}
              onSearchChange={typeTable.setSearch}
              placeholder="Search leave types…"
            />
            <DataTable
              loading={typesQuery.isLoading}
              columns={[
                { key: 'code', label: 'Code', sortable: true },
                { key: 'name', label: 'Name', sortable: true },
                { key: 'annualQuota', label: 'Quota / yr', sortable: true, className: 'text-right' },
                { key: 'rules', label: 'Rules' },
                { key: 'status', label: 'Status', sortable: true },
                { key: 'actions', label: '' },
              ]}
              sortKey={typeTable.sortKey}
              sortDir={typeTable.sortDir}
              onSort={typeTable.toggleSort}
              empty={
                typeTable.rows.length === 0 ? (
                  <EmptyState
                    title="No leave types"
                    description="Add CL / SL / EL so employees can apply for leave."
                  />
                ) : null
              }
            >
              {typeTable.rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--color-bg)]/60">
                  <Td>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                      style={{
                        background: `color-mix(in srgb, ${row.colorHex} 14%, transparent)`,
                        color: row.colorHex,
                      }}
                    >
                      {row.code}
                    </span>
                  </Td>
                  <Td>
                    <p className="font-medium">{row.name}</p>
                    {row.description ? (
                      <p className="line-clamp-1 text-[11px] text-[var(--color-muted)]">
                        {row.description}
                      </p>
                    ) : null}
                  </Td>
                  <Td className="text-right font-semibold">
                    {row.annualQuota > 0 ? row.annualQuota : '—'}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      <Badge tone={row.isPaid ? 'success' : 'neutral'} dot={false}>
                        {row.isPaid ? 'Paid' : 'Unpaid'}
                      </Badge>
                      {row.allowHalfDay ? (
                        <Badge tone="primary" dot={false}>
                          ½ day
                        </Badge>
                      ) : null}
                      {row.carryForward ? (
                        <Badge tone="primary" dot={false}>
                          CF ≤ {row.maxCarryForward}
                        </Badge>
                      ) : null}
                      {row.requiresProof ? (
                        <Badge tone="warning" dot={false}>
                          Doc
                        </Badge>
                      ) : null}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {row.status}
                    </Badge>
                  </Td>
                  <Td className="text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                        Edit
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="danger"
                        aria-label={`Remove ${row.code}`}
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </DataTable>
          </>
        ) : (
          <>
            <TableToolbar
              search={employeeTable.search}
              onSearchChange={employeeTable.setSearch}
              placeholder="Search employees…"
            />
            <DataTable
              loading={employeesQuery.isLoading}
              columns={[
                { key: 'name', label: 'Employee', sortable: true },
                { key: 'code', label: 'Code' },
                { key: 'used', label: 'Used / entitled' },
                { key: 'remaining', label: 'Remaining', sortable: true, className: 'text-right' },
                { key: 'actions', label: '' },
              ]}
              sortKey={employeeTable.sortKey}
              sortDir={employeeTable.sortDir}
              onSort={employeeTable.toggleSort}
              empty={
                employeeTable.rows.length === 0 ? (
                  <EmptyState
                    title="No employees"
                    description="Create MR / Manager accounts first."
                  />
                ) : null
              }
            >
              {employeeTable.rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--color-bg)]/60">
                  <Td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.fullName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{row.fullName}</p>
                        <p className="truncate text-[11px] text-[var(--color-muted)]">
                          {row.designation ?? row.role}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td className="font-mono text-xs">{row.employeeCode ?? '—'}</Td>
                  <Td className="min-w-[130px]">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold tabular-nums">
                        {row.leaveUsed} / {row.leaveEntitled}
                      </span>
                      <Meter
                        className="w-16"
                        value={row.leaveUsed}
                        total={row.leaveEntitled}
                        color="var(--color-primary)"
                      />
                    </div>
                  </Td>
                  <Td className="text-right font-semibold">{row.leaveRemaining}</Td>
                  <Td className="text-right">
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        setEntitleTarget({ userId: row.id, fullName: row.fullName });
                        setEntitleForm({ leaveTypeId: '', opening: 0, allocated: 0 });
                        setError(null);
                      }}
                    >
                      Set entitlement
                    </Button>
                  </Td>
                </tr>
              ))}
            </DataTable>
          </>
        )}
      </Card>

      {/* ── Leave type form ──────────────────────────────────────────────── */}
      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setError(null);
        }}
        title={editing ? `Edit ${editing.code}` : 'New leave type'}
        description="Quota 0 means the type has no yearly cap (e.g. LWP or comp-off)."
        icon={ScrollText}
        className="max-w-xl"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          {error ? <Alert message={error} /> : null}

          <FormSection title="Identity" icon={ScrollText}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input
                label="Code"
                required
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="CL"
                hint="Upper-case, no spaces"
              />
              <Input
                label="Name"
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Casual Leave"
              />
              <Input
                label="Colour"
                value={form.colorHex}
                onChange={(e) => setForm((f) => ({ ...f, colorHex: e.target.value }))}
                placeholder="#0f766e"
                hint="Hex — used on chips and the calendar"
              />
              <Select
                label="Status"
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as 'ACTIVE' }))
                }
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </Select>
            </div>
          </FormSection>

          <FormSection title="Entitlement rules" icon={SlidersHorizontal}>
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input
                label="Annual quota (days)"
                type="number"
                min={0}
                max={365}
                step="0.5"
                value={form.annualQuota}
                onChange={(e) => setForm((f) => ({ ...f, annualQuota: Number(e.target.value) }))}
              />
              <Input
                label="Max carry forward"
                type="number"
                min={0}
                max={365}
                step="0.5"
                disabled={!form.carryForward}
                value={form.maxCarryForward}
                onChange={(e) =>
                  setForm((f) => ({ ...f, maxCarryForward: Number(e.target.value) }))
                }
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['isPaid', 'Paid leave', 'Counts against a quota and is paid'],
                  ['carryForward', 'Carry forward', 'Unused days roll into next year'],
                  ['allowHalfDay', 'Allow half day', 'Employee can take 0.5 day'],
                  ['requiresProof', 'Requires document', 'Medical certificate etc.'],
                ] as const
              ).map(([key, label, hint]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5"
                >
                  <input
                    type="checkbox"
                    checked={form[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
                    className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block text-xs font-semibold text-[var(--color-ink)]">
                      {label}
                    </span>
                    <span className="block text-[11px] text-[var(--color-muted)]">{hint}</span>
                  </span>
                </label>
              ))}
            </div>

            <Textarea
              label="Description"
              optional
              className="mt-3.5"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Cannot be clubbed with sick leave."
            />
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
            <Button type="submit" loading={saveTypeMutation.isPending}>
              {editing ? 'Save changes' : 'Create type'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Entitlement modal ────────────────────────────────────────────── */}
      <Modal
        open={Boolean(entitleTarget)}
        onClose={() => setEntitleTarget(null)}
        title={`Entitlement — ${entitleTarget?.fullName ?? ''}`}
        description={`Opening balance carried in, plus days granted for ${year}. Used days are always derived from approved requests.`}
        icon={UserCog}
        className="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEntitleTarget(null)}>
              Close
            </Button>
            <Button
              loading={setBalanceMutation.isPending}
              disabled={!entitleForm.leaveTypeId}
              onClick={() => setBalanceMutation.mutate()}
            >
              Save entitlement
            </Button>
          </>
        }
      >
        {error ? <Alert message={error} /> : null}

        <div className="space-y-3">
          {(targetBalancesQuery.data?.balances ?? []).map((balance) => (
            <div
              key={balance.leaveTypeId}
              className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-2 font-semibold">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: balance.colorHex }}
                    aria-hidden
                  />
                  {balance.code} · {balance.name}
                </span>
                <span className="tabular-nums text-[var(--color-muted)]">
                  opening {balance.opening} · granted {balance.allocated} · used {balance.used}
                </span>
              </div>
              <Meter
                className="mt-1.5"
                value={balance.used}
                total={balance.entitled}
                pending={balance.pending}
                color={balance.colorHex}
              />
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-3.5 sm:grid-cols-3">
          <Select
            label="Leave type"
            required
            className="sm:col-span-3"
            value={entitleForm.leaveTypeId}
            onChange={(e) => {
              const chosen = (targetBalancesQuery.data?.balances ?? []).find(
                (b) => String(b.leaveTypeId) === e.target.value,
              );
              setEntitleForm({
                leaveTypeId: e.target.value,
                opening: chosen?.opening ?? 0,
                allocated: chosen?.allocated ?? 0,
              });
            }}
          >
            <option value="">Select…</option>
            {activeTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.code} — {type.name}
              </option>
            ))}
          </Select>
          <Input
            label="Opening balance"
            type="number"
            min={0}
            step="0.5"
            value={entitleForm.opening}
            onChange={(e) =>
              setEntitleForm((f) => ({ ...f, opening: Number(e.target.value) }))
            }
          />
          <Input
            label="Granted this year"
            type="number"
            min={0}
            step="0.5"
            value={entitleForm.allocated}
            onChange={(e) =>
              setEntitleForm((f) => ({ ...f, allocated: Number(e.target.value) }))
            }
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={`Remove ${deleteTarget?.code ?? ''}`}
        description="Only unused leave types can be deleted. If requests already reference it, set it Inactive instead."
        confirmLabel="Remove"
        loading={deleteTypeMutation.isPending}
        onConfirm={() => deleteTarget && deleteTypeMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
