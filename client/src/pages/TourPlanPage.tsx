import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Eraser,
  Inbox,
  Map as MapIcon,
  PartyPopper,
  Plane,
  Send,
  Stethoscope,
  Store,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ChoiceCards } from '@/components/ui/ChoiceCards';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select, Textarea } from '@/components/ui/Field';
import { Modal, FormSection } from '@/components/ui/Modal';
import { MonthCalendar, type MonthCalendarCell } from '@/components/ui/MonthCalendar';
import { Alert, Badge, Card, DetailRow, EmptyState, PageHeader } from '@/components/ui/Page';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { WORK_TYPE_LABEL, type WorkType } from '@/services/attendance.service';
import { doctorsApi } from '@/services/doctors.service';
import { storesApi } from '@/services/stores.service';
import { territoriesApi } from '@/services/territories.service';
import {
  TOUR_PLAN_STATUS_TONE,
  tourPlanApi,
  type TourPlan,
  type TourPlanDayPayload,
  type TourPlanListRow,
  type TourPlanStatus,
} from '@/services/tour-plan.service';
import { currentMonthKey, monthLabel, shiftMonth } from '@/utils/month';
import { formatDisplayDate } from '@/utils/datetime';

const WORK_TYPE_COLOR: Record<WorkType, string> = {
  FIELD: 'var(--color-primary)',
  OFFICE: 'var(--color-warning)',
  JOINT_WORK: 'var(--color-success)',
  LEAVE: 'var(--color-danger)',
  HOLIDAY: 'var(--color-muted)',
};

interface DraftCall {
  doctorId?: number;
  chemistId?: number;
  label: string;
  meta?: string;
}

interface DraftDay {
  planDate: string;
  workType: WorkType;
  territoryId?: number;
  territoryName?: string;
  jointWithUserId?: number;
  notes: string;
  calls: DraftCall[];
}

function planToDraft(plan: TourPlan | null): Map<string, DraftDay> {
  const map = new Map<string, DraftDay>();
  for (const day of plan?.days ?? []) {
    map.set(day.planDate, {
      planDate: day.planDate,
      workType: day.workType,
      territoryId: day.territory?.id,
      territoryName: day.territory?.name,
      jointWithUserId: day.jointWith?.id,
      notes: day.notes ?? '',
      calls: day.calls.map((call) =>
        call.doctor
          ? {
              doctorId: call.doctor.id,
              label: call.doctor.fullName,
              meta: call.doctor.specialization ?? `Cat ${call.doctor.category}`,
            }
          : {
              chemistId: call.chemist?.id,
              label: call.chemist?.name ?? '?',
              meta: 'Chemist',
            },
      ),
    });
  }
  return map;
}

function draftToPayload(draft: Map<string, DraftDay>): TourPlanDayPayload[] {
  return [...draft.values()].map((day) => ({
    planDate: day.planDate,
    workType: day.workType,
    territoryId: day.territoryId,
    jointWithUserId: day.jointWithUserId,
    notes: day.notes.trim() || undefined,
    calls: day.calls.map((call) =>
      call.doctorId ? { doctorId: call.doctorId } : { chemistId: call.chemistId },
    ),
  }));
}

function monthDates(month: string): string[] {
  const [year, mon] = month.split('-').map(Number);
  if (!year || !mon) return [];
  const daysInMonth = new Date(year, mon, 0).getDate();
  return Array.from(
    { length: daysInMonth },
    (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`,
  );
}

/* ────────────────────────────── MR: my plan ─────────────────────────────── */

function MyPlanView() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonthKey());
  const [draft, setDraft] = useState<Map<string, DraftDay>>(new Map());
  const [editor, setEditor] = useState<DraftDay | null>(null);
  const [viewDay, setViewDay] = useState<DraftDay | null>(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myQuery = useQuery({
    queryKey: ['tour-plan', 'my', month],
    queryFn: () => tourPlanApi.my(month),
  });
  const plan = myQuery.data?.plan ?? null;
  const managers = myQuery.data?.managers ?? [];
  const editable = !plan || plan.status === 'DRAFT' || plan.status === 'REJECTED';

  useEffect(() => {
    setDraft(planToDraft(myQuery.data?.plan ?? null));
  }, [myQuery.data]);

  const territoriesQuery = useQuery({
    queryKey: ['territories', 'flat'],
    queryFn: () => territoriesApi.list(),
    enabled: Boolean(editor),
  });
  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.list(),
    enabled: Boolean(editor),
  });
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesApi.list(),
    enabled: Boolean(editor),
  });

  const { user } = useAuth();
  const beatOptions = useMemo(
    () =>
      (territoriesQuery.data ?? [])
        .filter((t) => t.type === 'BEAT' || t.type === 'HQ')
        .map((t) => ({
          value: String(t.id),
          label: t.name,
          meta: t.parent ? `${t.type} · ${t.parent.name}` : t.type,
        })),
    [territoriesQuery.data],
  );
  const doctorOptions = useMemo(() => {
    const rows = [...(doctorsQuery.data ?? [])];
    // Assigned doctors first — the MR plans their own list, not the whole master.
    const isMine = (d: (typeof rows)[number]): boolean =>
      d.assignedMrs?.some((mr) => mr.id === user?.id) ?? false;
    rows.sort((a, b) => Number(isMine(b)) - Number(isMine(a)) || a.fullName.localeCompare(b.fullName));
    return rows.map((d) => ({
      value: String(d.id),
      label: d.fullName,
      meta: [isMine(d) ? 'Assigned to you' : null, d.specialization, d.city]
        .filter(Boolean)
        .join(' · '),
    }));
  }, [doctorsQuery.data, user?.id]);
  const chemistOptions = useMemo(
    () =>
      (storesQuery.data ?? []).map((s) => ({
        value: String(s.id),
        label: s.name,
        meta: s.city ?? undefined,
      })),
    [storesQuery.data],
  );

  const saveMutation = useMutation({
    mutationFn: (next: Map<string, DraftDay>) => tourPlanApi.saveMy(month, draftToPayload(next)),
    onSuccess: async () => {
      setEditor(null);
      setError(null);
      toast.success('Day saved to draft');
      await queryClient.invalidateQueries({ queryKey: ['tour-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['tour-plans'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const submitMutation = useMutation({
    mutationFn: () => tourPlanApi.submitMy(month),
    onSuccess: async () => {
      setConfirmSubmit(false);
      toast.success('Plan submitted', 'Your manager will find it in their inbox.');
      await queryClient.invalidateQueries({ queryKey: ['tour-plan'] });
      await queryClient.invalidateQueries({ queryKey: ['tour-plans'] });
    },
    onError: (err) => {
      setConfirmSubmit(false);
      toast.error('Cannot submit', getApiErrorMessage(err));
    },
  });

  const cells: MonthCalendarCell[] = useMemo(
    () =>
      monthDates(month).map((date) => {
        const day = draft.get(date);
        if (!day) {
          return { date, muted: true, disabled: !editable, title: editable ? 'Plan this day' : undefined };
        }
        return {
          date,
          label:
            day.workType === 'FIELD' || day.workType === 'JOINT_WORK'
              ? (day.territoryName ?? WORK_TYPE_LABEL[day.workType])
              : WORK_TYPE_LABEL[day.workType],
          meta: day.calls.length > 0 ? `${day.calls.length} call${day.calls.length > 1 ? 's' : ''}` : null,
          color: WORK_TYPE_COLOR[day.workType],
        };
      }),
    [draft, month, editable],
  );

  const fieldDays = [...draft.values()].filter((d) => d.workType === 'FIELD').length;
  const totalCalls = [...draft.values()].reduce((sum, d) => sum + d.calls.length, 0);

  function openDay(date: string): void {
    const existing = draft.get(date);
    const day: DraftDay = existing ?? {
      planDate: date,
      workType: 'FIELD',
      notes: '',
      calls: [],
    };
    if (editable) {
      setError(null);
      setEditor({ ...day, calls: [...day.calls] });
    } else if (existing) {
      setViewDay(existing);
    }
  }

  function saveEditorDay(): void {
    if (!editor) return;
    const next = new Map(draft);
    next.set(editor.planDate, editor);
    saveMutation.mutate(next);
  }

  function clearEditorDay(): void {
    if (!editor) return;
    const next = new Map(draft);
    next.delete(editor.planDate);
    saveMutation.mutate(next);
  }

  const status: TourPlanStatus = plan?.status ?? 'DRAFT';

  return (
    <div className="space-y-4">
      {/* ── Status banner ─────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Badge tone={TOUR_PLAN_STATUS_TONE[status]}>{status}</Badge>
            <div className="min-w-0 text-xs text-[var(--color-muted)]">
              {status === 'DRAFT' && !plan ? 'No plan yet — tap a day to start planning.' : null}
              {status === 'DRAFT' && plan ? 'Draft — submit when the month is ready.' : null}
              {status === 'SUBMITTED' ? 'Waiting for your manager — the plan is locked meanwhile.' : null}
              {status === 'APPROVED' ? (
                <>Approved{plan?.approvedBy ? ` by ${plan.approvedBy.fullName}` : ''} — feeds your My Day call list.</>
              ) : null}
              {status === 'REJECTED' ? (
                <span className="text-[var(--color-danger)]">
                  Rejected{plan?.remark ? ` — “${plan.remark}”` : ''}. Edit and resubmit.
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-[var(--color-muted)]">
            <span>{fieldDays} field days</span>
            <span>{totalCalls} calls</span>
            {editable && draft.size > 0 ? (
              <Button size="sm" onClick={() => setConfirmSubmit(true)}>
                <Send size={13} />
                Submit for approval
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <MonthCalendar
          month={month}
          cells={cells}
          onMonthChange={setMonth}
          onSelect={(cell) => openDay(cell.date)}
          loading={myQuery.isLoading || saveMutation.isPending}
          legend={(['FIELD', 'OFFICE', 'JOINT_WORK', 'LEAVE', 'HOLIDAY'] as WorkType[]).map(
            (type) => ({ label: WORK_TYPE_LABEL[type], color: WORK_TYPE_COLOR[type] }),
          )}
        />
      </Card>

      {/* ── Day editor ────────────────────────────────────────────────────── */}
      <Modal
        open={Boolean(editor)}
        onClose={() => setEditor(null)}
        title={editor ? formatDisplayDate(editor.planDate) : ''}
        description="Pick the work type, beat and the doctors / chemists you plan to call."
        icon={CalendarDays}
        className="max-w-xl"
        footer={
          <>
            {draft.has(editor?.planDate ?? '') ? (
              <Button variant="danger" onClick={clearEditorDay} loading={saveMutation.isPending}>
                <Eraser size={13} />
                Clear day
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditorDay} loading={saveMutation.isPending}>
              Save day
            </Button>
          </>
        }
      >
        {editor ? (
          <div className="space-y-4">
            {error ? <Alert message={error} /> : null}

            <ChoiceCards
              label="Work type"
              value={editor.workType}
              onChange={(workType) =>
                setEditor((d) =>
                  d
                    ? {
                        ...d,
                        workType,
                        calls: workType === 'FIELD' || workType === 'JOINT_WORK' ? d.calls : [],
                      }
                    : d,
                )
              }
              columns={3}
              choices={[
                { value: 'FIELD' as WorkType, label: 'Field', description: 'Beat work', icon: MapIcon },
                { value: 'OFFICE' as WorkType, label: 'Office', description: 'HQ / admin day', icon: Briefcase },
                { value: 'JOINT_WORK' as WorkType, label: 'Joint work', description: 'With manager', icon: Users },
                { value: 'LEAVE' as WorkType, label: 'Leave', description: 'Planned leave', icon: Plane },
                { value: 'HOLIDAY' as WorkType, label: 'Holiday', description: 'Company holiday', icon: PartyPopper },
              ]}
            />

            {editor.workType === 'FIELD' || editor.workType === 'JOINT_WORK' ? (
              <>
                <SearchableSelect
                  label="Beat / HQ"
                  value={editor.territoryId ? String(editor.territoryId) : ''}
                  onChange={(value) =>
                    setEditor((d) =>
                      d
                        ? {
                            ...d,
                            territoryId: value ? Number(value) : undefined,
                            territoryName: beatOptions.find((o) => o.value === value)?.label,
                          }
                        : d,
                    )
                  }
                  options={beatOptions}
                  placeholder={
                    territoriesQuery.isLoading ? 'Loading beats…' : 'Where are you working?'
                  }
                />

                {editor.workType === 'JOINT_WORK' ? (
                  <Select
                    label="Joint work with"
                    value={editor.jointWithUserId ? String(editor.jointWithUserId) : ''}
                    onChange={(e) =>
                      setEditor((d) =>
                        d
                          ? {
                              ...d,
                              jointWithUserId: e.target.value ? Number(e.target.value) : undefined,
                            }
                          : d,
                      )
                    }
                    hint="Your manager, or a manager above them"
                  >
                    <option value="">Select manager…</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.fullName} ({m.role})
                      </option>
                    ))}
                  </Select>
                ) : null}

                <FormSection title="Planned calls" icon={Stethoscope}>
                  <div className="space-y-3">
                    {editor.calls.length > 0 ? (
                      <ul className="space-y-1.5">
                        {editor.calls.map((call, index) => (
                          <li
                            key={`${call.doctorId ?? 'c'}-${call.chemistId ?? 'd'}-${index}`}
                            className="flex items-center justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-3 py-2"
                          >
                            <span className="flex min-w-0 items-center gap-2 text-sm">
                              {call.doctorId ? (
                                <Stethoscope size={13} className="shrink-0 text-[var(--color-primary)]" />
                              ) : (
                                <Store size={13} className="shrink-0 text-[var(--color-success)]" />
                              )}
                              <span className="truncate font-semibold">{call.label}</span>
                              {call.meta ? (
                                <span className="truncate text-[11px] text-[var(--color-muted)]">
                                  {call.meta}
                                </span>
                              ) : null}
                            </span>
                            <button
                              type="button"
                              aria-label="Remove call"
                              className="rounded-full p-1 text-[var(--color-muted)] hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
                              onClick={() =>
                                setEditor((d) =>
                                  d ? { ...d, calls: d.calls.filter((_, i) => i !== index) } : d,
                                )
                              }
                            >
                              <X size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-[var(--color-muted)]">
                        No calls planned yet — add the doctors you intend to meet.
                      </p>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                      <SearchableSelect
                        label="Add doctor"
                        value=""
                        onChange={(value) => {
                          if (!value) return;
                          const option = doctorOptions.find((o) => o.value === value);
                          setEditor((d) =>
                            d && !d.calls.some((c) => c.doctorId === Number(value))
                              ? {
                                  ...d,
                                  calls: [
                                    ...d.calls,
                                    { doctorId: Number(value), label: option?.label ?? value, meta: option?.meta },
                                  ],
                                }
                              : d,
                          );
                        }}
                        options={doctorOptions}
                        placeholder={doctorsQuery.isLoading ? 'Loading doctors…' : 'Search doctor…'}
                      />
                      <SearchableSelect
                        label="Add chemist"
                        value=""
                        onChange={(value) => {
                          if (!value) return;
                          const option = chemistOptions.find((o) => o.value === value);
                          setEditor((d) =>
                            d && !d.calls.some((c) => c.chemistId === Number(value))
                              ? {
                                  ...d,
                                  calls: [
                                    ...d.calls,
                                    { chemistId: Number(value), label: option?.label ?? value, meta: 'Chemist' },
                                  ],
                                }
                              : d,
                          );
                        }}
                        options={chemistOptions}
                        placeholder={storesQuery.isLoading ? 'Loading chemists…' : 'Search chemist…'}
                      />
                    </div>
                  </div>
                </FormSection>
              </>
            ) : null}

            <Textarea
              label="Notes"
              optional
              value={editor.notes}
              onChange={(e) => setEditor((d) => (d ? { ...d, notes: e.target.value } : d))}
              placeholder="Camp at district hospital, stockist payment follow-up…"
            />
          </div>
        ) : null}
      </Modal>

      {/* ── Read-only day view (submitted / approved) ─────────────────────── */}
      <Modal
        open={Boolean(viewDay)}
        onClose={() => setViewDay(null)}
        title={viewDay ? formatDisplayDate(viewDay.planDate) : ''}
        badge={status}
        icon={CalendarDays}
      >
        {viewDay ? (
          <dl>
            <DetailRow label="Work type" value={WORK_TYPE_LABEL[viewDay.workType]} />
            <DetailRow label="Beat / HQ" value={viewDay.territoryName} />
            <DetailRow
              label="Joint with"
              value={managers.find((m) => m.id === viewDay.jointWithUserId)?.fullName}
            />
            <DetailRow
              label="Calls"
              value={
                viewDay.calls.length > 0 ? viewDay.calls.map((c) => c.label).join(', ') : null
              }
            />
            <DetailRow label="Notes" value={viewDay.notes} />
          </dl>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirmSubmit}
        variant="generic"
        title={`Submit ${monthLabel(month)} plan?`}
        description="Once submitted the plan locks until your manager approves or rejects it."
        confirmLabel="Submit plan"
        loading={submitMutation.isPending}
        onConfirm={() => submitMutation.mutate()}
        onClose={() => setConfirmSubmit(false)}
      />
    </div>
  );
}

/* ─────────────────────────── Manager: team plans ────────────────────────── */

function ManagerView({ mode }: { mode: 'inbox' | 'team' }) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [month, setMonth] = useState(currentMonthKey());
  const [statusFilter, setStatusFilter] = useState<TourPlanStatus | ''>('');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | null>(null);
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['tour-plans', mode, mode === 'inbox' ? 'SUBMITTED' : `${month}:${statusFilter}`],
    queryFn: () =>
      mode === 'inbox'
        ? tourPlanApi.list({ status: 'SUBMITTED' })
        : tourPlanApi.list({ month, status: statusFilter || undefined }),
  });

  const detailQuery = useQuery({
    queryKey: ['tour-plans', 'detail', detailId],
    queryFn: () => tourPlanApi.get(detailId!),
    enabled: detailId != null,
  });
  const detail = detailId != null ? (detailQuery.data ?? null) : null;

  const decideMutation = useMutation({
    mutationFn: (input: { id: number; status: 'APPROVED' | 'REJECTED'; remark?: string }) =>
      tourPlanApi.decide(input.id, { status: input.status, remark: input.remark }),
    onSuccess: async (row) => {
      setDecision(null);
      setRemark('');
      setDetailId(null);
      setError(null);
      toast.success(row.status === 'APPROVED' ? 'Tour plan approved' : 'Tour plan rejected');
      await queryClient.invalidateQueries({ queryKey: ['tour-plans'] });
      await queryClient.invalidateQueries({ queryKey: ['tour-plan'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const rows: TourPlanListRow[] = listQuery.data ?? [];

  return (
    <div className="space-y-4">
      {mode === 'team' ? (
        <Card className="flex flex-wrap items-center gap-3 p-3">
          <div className="flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
            <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, -1))}>
              ←
            </Button>
            <span className="px-1 text-xs font-bold">{monthLabel(month)}</span>
            <Button size="sm" variant="ghost" onClick={() => setMonth(shiftMonth(month, 1))}>
              →
            </Button>
          </div>
          <div className="w-44">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as TourPlanStatus | '')}
            >
              <option value="">All statuses</option>
              {(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as TourPlanStatus[]).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        </Card>
      ) : null}

      <Card>
        {listQuery.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={mode === 'inbox' ? 'Inbox is clear' : 'No plans for this filter'}
            description={
              mode === 'inbox'
                ? 'Submitted tour plans from your team will land here for approval.'
                : 'Try another month or status.'
            }
          />
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--color-bg)]/60"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-ink)]">
                    {row.user?.fullName ?? '—'}
                    {row.user?.id === user?.id ? (
                      <span className="ml-1.5 text-[11px] font-normal text-[var(--color-muted)]">(you)</span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    {monthLabel(row.month)} · {row.counts.fieldDays} field days ·{' '}
                    {row.counts.calls} calls
                    {row.submittedAt
                      ? ` · submitted ${formatDisplayDate(row.submittedAt.slice(0, 10))}`
                      : ''}
                  </p>
                </div>
                <Badge tone={TOUR_PLAN_STATUS_TONE[row.status]}>{row.status}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setDetailId(row.id)}>
                  View
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ── Plan detail + decision ────────────────────────────────────────── */}
      <Modal
        open={detailId != null}
        onClose={() => {
          setDetailId(null);
          setDecision(null);
          setRemark('');
          setError(null);
        }}
        title={detail?.user?.fullName ?? 'Tour plan'}
        description={detail ? `${monthLabel(detail.month)} — ${detail.days.length} planned days` : undefined}
        badge={detail?.status}
        icon={MapIcon}
        className="max-w-2xl"
        footer={
          detail && detail.status === 'SUBMITTED' && detail.userId !== user?.id ? (
            <>
              <Button
                variant="danger"
                loading={decideMutation.isPending && decision === 'REJECTED'}
                onClick={() => {
                  setDecision('REJECTED');
                  decideMutation.mutate({ id: detail.id, status: 'REJECTED', remark: remark.trim() || undefined });
                }}
              >
                <XCircle size={14} />
                Reject
              </Button>
              <Button
                loading={decideMutation.isPending && decision === 'APPROVED'}
                onClick={() => {
                  setDecision('APPROVED');
                  decideMutation.mutate({ id: detail.id, status: 'APPROVED', remark: remark.trim() || undefined });
                }}
              >
                <CheckCircle2 size={14} />
                Approve
              </Button>
            </>
          ) : undefined
        }
      >
        {error ? <Alert message={error} /> : null}
        {detailQuery.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : detail ? (
          <div className="space-y-4">
            {detail.remark ? (
              <Alert tone={detail.status === 'REJECTED' ? 'danger' : 'primary'} message={`Remark: ${detail.remark}`} />
            ) : null}

            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/70 text-[10px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Beat</th>
                    <th className="px-3 py-2">Calls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {detail.days.map((day) => (
                    <tr key={day.id}>
                      <td className="px-3 py-2 font-semibold whitespace-nowrap">
                        {formatDisplayDate(day.planDate)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="font-semibold"
                          style={{ color: WORK_TYPE_COLOR[day.workType] }}
                        >
                          {WORK_TYPE_LABEL[day.workType]}
                        </span>
                        {day.jointWith ? (
                          <span className="block text-[10px] text-[var(--color-muted)]">
                            with {day.jointWith.fullName}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{day.territory?.name ?? '—'}</td>
                      <td className="max-w-[260px] px-3 py-2 text-[var(--color-muted)]">
                        {day.calls.length > 0
                          ? day.calls
                              .map((c) => c.doctor?.fullName ?? c.chemist?.name)
                              .filter(Boolean)
                              .join(', ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {detail.status === 'SUBMITTED' && detail.userId !== user?.id ? (
              <Textarea
                label="Remark"
                optional
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Looks good — add Dr. Gupta on Tuesdays…"
              />
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ────────────────────────────────── Page ────────────────────────────────── */

type TabValue = 'my' | 'inbox' | 'team';

export function TourPlanPage() {
  const { can } = useAuth();
  const canOwn = can('tour-plan:own');
  const canManage = can('tour-plan:manage');
  const [tab, setTab] = useState<TabValue>(canOwn ? 'my' : 'inbox');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tour plan"
        description="Monthly plan (MTP) — draft your beat-wise call list, submit, and work the approved plan from My Day."
      />

      {canOwn && canManage ? (
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'my' as TabValue, label: 'My plan', icon: User },
            { value: 'inbox' as TabValue, label: 'Inbox', icon: Inbox },
            { value: 'team' as TabValue, label: 'Team plans', icon: Users },
          ]}
        />
      ) : null}

      {tab === 'my' && canOwn ? <MyPlanView /> : null}
      {tab !== 'my' && canManage ? <ManagerView key={tab} mode={tab === 'inbox' ? 'inbox' : 'team'} /> : null}
      {!canOwn && !canManage ? (
        <Card>
          <EmptyState
            title="No tour plan access"
            description="Ask an administrator for the tour plan permission."
          />
        </Card>
      ) : null}
    </div>
  );
}
