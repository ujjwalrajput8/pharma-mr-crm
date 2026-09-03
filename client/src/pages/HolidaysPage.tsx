import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  PartyPopper,
  Table2,
  Trash2,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DataTable, TableToolbar, Td } from '@/components/ui/DataTable';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { MonthCalendar, type MonthCalendarCell } from '@/components/ui/MonthCalendar';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader, StatTile } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useClientTable } from '@/hooks/useClientTable';
import { useAuth } from '@/store/AuthContext';
import {
  HOLIDAY_TYPE_LABEL,
  holidaysApi,
  type Holiday,
  type HolidayType,
} from '@/services/holidays.service';
import { formatDisplayDate, toIsoDate } from '@/utils/datetime';
import { currentMonthKey, shiftMonth } from '@/utils/month';

type TabValue = 'calendar' | 'list';

const TYPE_COLORS: Record<HolidayType, string> = {
  NATIONAL: 'var(--color-primary)',
  FESTIVAL: 'var(--color-cal-followup)',
  REGIONAL: 'var(--color-cal-visit)',
  COMPANY: 'var(--color-success)',
  WEEKLY_OFF: 'var(--color-muted)',
};

const emptyForm = {
  holidayDate: toIsoDate(new Date()),
  name: '',
  type: 'FESTIVAL' as HolidayType,
  isOptional: false,
  description: '',
};

export function HolidaysPage() {
  const { can } = useAuth();
  const canManage = can('holidays:manage');
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState<TabValue>('calendar');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(currentMonthKey());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Holiday | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const [error, setError] = useState<string | null>(null);

  const holidaysQuery = useQuery({
    queryKey: ['holidays', year],
    queryFn: () => holidaysApi.list({ year }),
  });

  const holidays = useMemo(() => holidaysQuery.data ?? [], [holidaysQuery.data]);

  const cells: MonthCalendarCell[] = useMemo(
    () =>
      holidays
        .filter((holiday) => holiday.holidayDate.startsWith(month))
        .map((holiday) => ({
          date: holiday.holidayDate,
          label: holiday.name,
          meta: holiday.isOptional ? 'Optional' : HOLIDAY_TYPE_LABEL[holiday.type],
          color: TYPE_COLORS[holiday.type],
          title: holiday.description ?? undefined,
        })),
    [holidays, month],
  );

  const table = useClientTable({
    data: holidays,
    getSearchText: (row) =>
      [row.name, row.holidayDate, row.type, row.weekday, row.description]
        .filter(Boolean)
        .join(' '),
    getSortValue: (row, key) => {
      if (key === 'date') return row.holidayDate;
      if (key === 'name') return row.name;
      if (key === 'type') return row.type;
      return undefined;
    },
    initialSortKey: 'date',
    pageSize: 30,
  });

  async function invalidate(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['holidays'] }),
      queryClient.invalidateQueries({ queryKey: ['attendance'] }),
    ]);
  }

  const saveMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) =>
      editing
        ? holidaysApi.update(editing.id, {
            ...payload,
            description: payload.description || undefined,
          })
        : holidaysApi.create({ ...payload, description: payload.description || undefined }),
    onSuccess: async () => {
      setFormOpen(false);
      setEditing(null);
      setForm(emptyForm);
      setError(null);
      toast.success(editing ? 'Holiday updated' : 'Holiday added');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => holidaysApi.remove(id),
    onSuccess: async () => {
      setDeleteTarget(null);
      toast.success('Holiday removed');
      await invalidate();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function openCreate(date?: string): void {
    setEditing(null);
    setForm({ ...emptyForm, holidayDate: date ?? `${month}-01` });
    setError(null);
    setFormOpen(true);
  }

  function openEdit(holiday: Holiday): void {
    setEditing(holiday);
    setForm({
      holidayDate: holiday.holidayDate,
      name: holiday.name,
      type: holiday.type,
      isOptional: holiday.isOptional,
      description: holiday.description ?? '',
    });
    setError(null);
    setFormOpen(true);
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    saveMutation.mutate(form);
  }

  const stats = {
    total: holidays.length,
    optional: holidays.filter((h) => h.isOptional).length,
    national: holidays.filter((h) => h.type === 'NATIONAL').length,
    upcoming: holidays.filter((h) => h.holidayDate >= toIsoDate(new Date())).length,
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Holiday calendar"
        description="Company and regional holidays. Days listed here are skipped when counting leave and are marked on the attendance register."
        actions={
          canManage ? (
            <Button onClick={() => openCreate()}>
              <CalendarPlus size={15} />
              Add holiday
            </Button>
          ) : null
        }
      />

      {error && !formOpen ? <Alert message={error} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label={`Holidays ${year}`}
          value={stats.total}
          icon={PartyPopper}
          tone="primary"
        />
        <StatTile label="National" value={stats.national} icon={CalendarDays} />
        <StatTile
          label="Optional / restricted"
          value={stats.optional}
          hint="Employee must still apply"
          icon={CalendarDays}
          tone="warning"
        />
        <StatTile label="Still upcoming" value={stats.upcoming} icon={CalendarDays} />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            items={[
              { value: 'calendar', label: 'Calendar', icon: CalendarDays },
              { value: 'list', label: 'Full year list', icon: Table2 },
            ]}
          />

          <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5">
            <button
              type="button"
              onClick={() => {
                setYear((y) => y - 1);
                setMonth(shiftMonth(`${year - 1}-01`, 0));
              }}
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
              aria-label="Previous year"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="min-w-[3.5rem] text-center text-xs font-bold tabular-nums">
              {year}
            </span>
            <button
              type="button"
              onClick={() => {
                setYear((y) => y + 1);
                setMonth(shiftMonth(`${year + 1}-01`, 0));
              }}
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-primary)]"
              aria-label="Next year"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {tab === 'calendar' ? (
          <div className="p-4">
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              cells={cells}
              loading={holidaysQuery.isFetching}
              onSelect={
                canManage
                  ? (cell) => {
                      const existing = holidays.find((h) => h.holidayDate === cell.date);
                      if (existing) openEdit(existing);
                      else openCreate(cell.date);
                    }
                  : undefined
              }
              legend={(Object.keys(TYPE_COLORS) as HolidayType[]).map((type) => ({
                label: HOLIDAY_TYPE_LABEL[type],
                color: TYPE_COLORS[type],
              }))}
            />
            {canManage ? (
              <p className="mt-3 text-[11px] text-[var(--color-muted)]">
                Tip: click any date to add or edit that day's holiday.
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <TableToolbar
              search={table.search}
              onSearchChange={table.setSearch}
              placeholder="Search holidays…"
            />
            <DataTable
              loading={holidaysQuery.isLoading}
              columns={[
                { key: 'date', label: 'Date', sortable: true },
                { key: 'day', label: 'Day' },
                { key: 'name', label: 'Holiday', sortable: true },
                { key: 'type', label: 'Type', sortable: true },
                { key: 'note', label: 'Note' },
                ...(canManage ? [{ key: 'actions', label: '' }] : []),
              ]}
              sortKey={table.sortKey}
              sortDir={table.sortDir}
              onSort={table.toggleSort}
              empty={
                table.rows.length === 0 ? (
                  <EmptyState
                    title={`No holidays for ${year}`}
                    description="Add the year's festival and company holidays so leave counts stay correct."
                  />
                ) : null
              }
            >
              {table.rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[var(--color-bg)]/60">
                  <Td className="whitespace-nowrap font-semibold">
                    {formatDisplayDate(row.holidayDate)}
                  </Td>
                  <Td className="text-xs text-[var(--color-muted)]">{row.weekday}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: TYPE_COLORS[row.type] }}
                        aria-hidden
                      />
                      <span className="font-medium">{row.name}</span>
                      {row.isOptional ? <Badge tone="warning">Optional</Badge> : null}
                    </div>
                  </Td>
                  <Td className="text-xs">{HOLIDAY_TYPE_LABEL[row.type]}</Td>
                  <Td className="max-w-[220px] text-xs text-[var(--color-muted)]">
                    <span className="line-clamp-1">{row.description ?? '—'}</span>
                  </Td>
                  {canManage ? (
                    <Td className="text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)}>
                          Edit
                        </Button>
                        <Button
                          size="icon-sm"
                          variant="danger"
                          aria-label={`Remove ${row.name}`}
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </DataTable>
          </>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
          setError(null);
        }}
        title={editing ? 'Edit holiday' : 'Add holiday'}
        description="Optional (restricted) holidays are not auto-marked — employees apply for them."
        icon={PartyPopper}
      >
        <form id="holiday-form" onSubmit={onSubmit} className="space-y-3.5">
          {error ? <Alert message={error} /> : null}

          <DatePicker
            label="Date"
            required
            value={form.holidayDate}
            onChange={(value) => setForm((f) => ({ ...f, holidayDate: value }))}
          />
          <Input
            label="Holiday name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Diwali"
          />
          <Select
            label="Type"
            required
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as HolidayType }))}
          >
            {(Object.keys(HOLIDAY_TYPE_LABEL) as HolidayType[]).map((type) => (
              <option key={type} value={type}>
                {HOLIDAY_TYPE_LABEL[type]}
              </option>
            ))}
          </Select>

          <label className="flex cursor-pointer items-start gap-2.5 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3.5 py-3">
            <input
              type="checkbox"
              checked={form.isOptional}
              onChange={(e) => setForm((f) => ({ ...f, isOptional: e.target.checked }))}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
            />
            <span>
              <span className="block text-xs font-semibold text-[var(--color-ink)]">
                Optional / restricted holiday
              </span>
              <span className="block text-[11px] text-[var(--color-muted)]">
                Still counts as a working day unless the employee applies for leave.
              </span>
            </span>
          </label>

          <Textarea
            label="Note"
            optional
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Office closed. Depot dispatch resumes next working day."
          />

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
              {editing ? 'Save changes' : 'Add holiday'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remove holiday"
        description={`${deleteTarget?.name ?? ''} on ${
          deleteTarget ? formatDisplayDate(deleteTarget.holidayDate) : ''
        } will no longer be treated as a holiday. Leave already approved is not recalculated.`}
        confirmLabel="Remove"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
