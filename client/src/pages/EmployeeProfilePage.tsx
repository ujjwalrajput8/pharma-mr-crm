import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Clock3,
  Gift,
  HeartPulse,
  IdCard,
  IndianRupee,
  Landmark,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Stethoscope,
  Timer,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { Meter } from '@/components/ui/Meter';
import { Modal, FormSection } from '@/components/ui/Modal';
import { MonthCalendar, type MonthCalendarCell } from '@/components/ui/MonthCalendar';
import {
  Alert,
  Badge,
  Card,
  DetailRow,
  EmptyState,
  PageHeader,
  SectionCard,
  StatTile,
} from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import {
  employeesApi,
  type EmployeeProfile,
  type EmployeeProfilePayload,
} from '@/services/employees.service';
import { GrantCompOffDialog } from '@/components/leave/GrantCompOffDialog';
import { ATTENDANCE_STATUS_META, attendanceApi } from '@/services/attendance.service';
import { LEAVE_STATUS_TONE, type LeaveStatus } from '@/services/leaves.service';
import { formatDisplayDate } from '@/utils/datetime';
import { currentMonthKey, monthAnchorDate } from '@/utils/month';

type TabValue = 'overview' | 'attendance' | 'leave' | 'records';

/** Flattens a profile into the editable HR field set. */
function toEditForm(profile: EmployeeProfile): EmployeeProfilePayload {
  return {
    designation: profile.employment.designation,
    joiningDate: profile.employment.joiningDate,
    assignedArea: profile.employment.assignedArea,
    exitDate: profile.employment.exitDate,
    exitReason: profile.employment.exitReason,
    dob: profile.personal.dob,
    gender: profile.personal.gender,
    bloodGroup: profile.personal.bloodGroup,
    maritalStatus: profile.personal.maritalStatus,
    qualification: profile.personal.qualification,
    address: profile.personal.address,
    emergencyName: profile.personal.emergencyName,
    emergencyPhone: profile.personal.emergencyPhone,
    panNumber: profile.statutory.panNumber,
    aadhaarNumber: profile.statutory.aadhaarNumber,
    bankName: profile.statutory.bankName,
    bankAccountNo: profile.statutory.bankAccountNo,
    bankIfsc: profile.statutory.bankIfsc,
  };
}

function tenureText(months: number | null): string {
  if (months === null) return '—';
  if (months < 1) return 'Joined this month';
  if (months < 12) return `${months} months`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} year${years > 1 ? 's' : ''}` : `${years}y ${rest}m`;
}

export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const employeeId = Number(id);
  const { user, can } = useAuth();
  const canEdit = can('users:manage');
  const canGrantCompOff = can('leaves:manage');
  const queryClient = useQueryClient();
  const toast = useToast();

  const [tab, setTab] = useState<TabValue>('overview');
  const [month, setMonth] = useState(currentMonthKey());
  const [editOpen, setEditOpen] = useState(false);
  const [compOffOpen, setCompOffOpen] = useState(false);
  const [edit, setEdit] = useState<EmployeeProfilePayload>({});
  const [error, setError] = useState<string | null>(null);

  const isSelf = user?.id === employeeId;

  const profileQuery = useQuery({
    queryKey: ['employee', employeeId, month],
    queryFn: () =>
      isSelf
        ? employeesApi.me({ month: monthAnchorDate(month) })
        : employeesApi.profile(employeeId, { month: monthAnchorDate(month) }),
    enabled: Number.isFinite(employeeId) && employeeId > 0,
  });

  const calendarQuery = useQuery({
    queryKey: ['attendance', 'calendar', employeeId, month],
    queryFn: () =>
      attendanceApi.calendar({ userId: employeeId, month: monthAnchorDate(month) }),
    enabled: tab === 'attendance' && Number.isFinite(employeeId),
  });

  const profile = profileQuery.data;

  function openEdit(): void {
    if (!profile) return;
    setEdit(toEditForm(profile));
    setError(null);
    setEditOpen(true);
  }

  const updateMutation = useMutation({
    mutationFn: (payload: EmployeeProfilePayload) => employeesApi.update(employeeId, payload),
    onSuccess: async () => {
      setEditOpen(false);
      setError(null);
      toast.success('Employee record updated');
      await queryClient.invalidateQueries({ queryKey: ['employee', employeeId] });
      await queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const calendarCells: MonthCalendarCell[] = useMemo(() => {
    const days = calendarQuery.data?.days ?? [];
    return days.map((day) => {
      if (day.status) {
        const meta = ATTENDANCE_STATUS_META[day.status];
        return {
          date: day.date,
          label: day.status === 'HOLIDAY' && day.holiday ? day.holiday.name : meta.label,
          meta: day.workingHours ? `${day.workingHours} h` : null,
          color: meta.color,
          muted: day.status === 'HOLIDAY',
          flagged: Boolean(day.flagReason),
          title: day.flagReason ?? day.remarks ?? undefined,
        };
      }
      if (day.holiday) {
        return {
          date: day.date,
          label: day.holiday.name,
          color: 'var(--color-muted)',
          muted: true,
        };
      }
      if (day.isSunday) {
        return { date: day.date, label: 'Weekly off', color: 'var(--color-muted)', muted: true };
      }
      if (day.isFuture) return { date: day.date, muted: true, disabled: true };
      return { date: day.date, label: 'Not marked' };
    });
  }, [calendarQuery.data]);

  if (profileQuery.isLoading) {
    return (
      <Card className="p-12 text-center">
        <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent" />
        <p className="mt-3 text-sm text-[var(--color-muted)]">Loading employee record…</p>
      </Card>
    );
  }

  if (profileQuery.isError || !profile) {
    return (
      <div className="space-y-4">
        <Alert message={getApiErrorMessage(profileQuery.error, 'Employee not found')} />
        <Link to="/employees">
          <Button variant="secondary">
            <ArrowLeft size={15} />
            Back to employees
          </Button>
        </Link>
      </div>
    );
  }

  const monthAtt = profile.attendance.month;
  const yearAtt = profile.attendance.year;
  const paidBalances = profile.leave.balances.filter((b) => b.isPaid && !b.unlimited);

  return (
    <div className="space-y-5">
      <PageHeader
        title={profile.fullName}
        description={[profile.employment.designation, profile.employment.employeeCode]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <>
            <Link to="/employees">
              <Button variant="ghost">
                <ArrowLeft size={15} />
                All employees
              </Button>
            </Link>
            {canEdit ? (
              <Button onClick={openEdit}>
                <PencilLine size={15} />
                Edit record
              </Button>
            ) : null}
          </>
        }
      />

      {error && !editOpen ? <Alert message={error} /> : null}

      {/* ── Identity card ────────────────────────────────────────────────── */}
      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={profile.fullName} photoUrl={profile.personal.photoUrl} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight">{profile.fullName}</h3>
                <Badge tone={profile.role === 'MANAGER' ? 'primary' : 'neutral'}>
                  {profile.role}
                </Badge>
                <Badge tone={profile.status === 'ACTIVE' ? 'success' : 'danger'}>
                  {profile.status}
                </Badge>
                {profile.employment.exitDate ? <Badge tone="warning">Exited</Badge> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--color-muted)]">
                <span className="inline-flex items-center gap-1.5">
                  <Mail size={13} /> {profile.email}
                </span>
                {profile.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone size={13} /> {profile.phone}
                  </span>
                ) : null}
                {profile.employment.assignedArea ? (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={13} /> {profile.employment.assignedArea}
                  </span>
                ) : null}
                {profile.manager ? (
                  <span className="inline-flex items-center gap-1.5">
                    <BriefcaseBusiness size={13} /> Reports to {profile.manager.fullName}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <dl className="grid shrink-0 grid-cols-2 gap-x-6 gap-y-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-4 py-3 sm:grid-cols-4">
            <div>
              <dt className="text-[10px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                Code
              </dt>
              <dd className="mt-0.5 font-mono text-sm font-semibold">
                {profile.employment.employeeCode ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                Tenure
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {tenureText(profile.employment.tenureMonths)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                Reports
              </dt>
              <dd className="mt-0.5 text-sm font-semibold tabular-nums">
                {profile.directReports}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                Last login
              </dt>
              <dd className="mt-0.5 text-sm font-semibold">
                {profile.lastLoginAt
                  ? new Date(profile.lastLoginAt).toLocaleDateString()
                  : 'Never'}
              </dd>
            </div>
          </dl>
        </div>
      </Card>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'overview', label: 'Overview', icon: UserRound },
          { value: 'attendance', label: 'Attendance', icon: CalendarDays },
          { value: 'leave', label: 'Leave', icon: Clock3 },
          { value: 'records', label: 'Employment & bank', icon: IdCard },
        ]}
      />

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      {tab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Present this month"
              value={monthAtt.present + monthAtt.late}
              hint={`${monthAtt.late} late · ${monthAtt.absent} absent`}
              icon={CalendarDays}
              tone="success"
            />
            <StatTile
              label="Leave left"
              value={profile.leave.totals.remaining}
              hint={`${profile.leave.totals.used} of ${profile.leave.totals.entitled} used`}
              icon={Clock3}
              tone="primary"
            />
            <StatTile
              label="Visits this month"
              value={profile.activity.visits}
              hint={`${profile.activity.appointments} appointments`}
              icon={ClipboardList}
            />
            <StatTile
              label="POB this month"
              value={`₹${profile.activity.salesAmount.toLocaleString('en-IN')}`}
              hint={`${profile.activity.salesCount} invoice(s)`}
              icon={IndianRupee}
              tone="primary"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Field footprint" icon={Stethoscope}>
              <dl>
                <DetailRow label="Assigned doctors" value={profile.activity.assignedDoctors} />
                <DetailRow label="Visits (this month)" value={profile.activity.visits} />
                <DetailRow
                  label="Appointments (this month)"
                  value={profile.activity.appointments}
                />
                <DetailRow label="Samples given" value={profile.activity.samplesGiven} />
                <DetailRow label="Territory" value={profile.territory?.name} />
                <DetailRow label="Beat / area" value={profile.employment.assignedArea} />
              </dl>
            </SectionCard>

            <SectionCard title={`Attendance ${yearAtt.year}`} icon={Timer}>
              <dl>
                <DetailRow label="Present days" value={yearAtt.present} />
                <DetailRow label="Late days" value={yearAtt.late} />
                <DetailRow label="Absent days" value={yearAtt.absent} />
                <DetailRow label="Leave days" value={yearAtt.leave} />
                <DetailRow label="Flagged check-ins" value={yearAtt.flagged} />
                <DetailRow label="Hours logged" value={`${yearAtt.workingHours} h`} />
              </dl>
            </SectionCard>

            <SectionCard title="Personal" icon={HeartPulse}>
              <dl>
                <DetailRow
                  label="Date of birth"
                  value={profile.personal.dob ? formatDisplayDate(profile.personal.dob) : null}
                />
                <DetailRow label="Gender" value={profile.personal.gender} />
                <DetailRow label="Blood group" value={profile.personal.bloodGroup} />
                <DetailRow label="Marital status" value={profile.personal.maritalStatus} />
                <DetailRow label="Qualification" value={profile.personal.qualification} />
                <DetailRow label="Address" value={profile.personal.address} />
              </dl>
            </SectionCard>

            <SectionCard title="Emergency contact" icon={Phone}>
              <dl>
                <DetailRow label="Name" value={profile.personal.emergencyName} />
                <DetailRow label="Phone" value={profile.personal.emergencyPhone} mono />
              </dl>
              {!profile.personal.emergencyName ? (
                <p className="mt-2 text-[11px] text-[var(--color-muted)]">
                  No emergency contact on file — worth capturing for field staff.
                </p>
              ) : null}
            </SectionCard>
          </div>
        </div>
      ) : null}

      {/* ── Attendance ───────────────────────────────────────────────────── */}
      {tab === 'attendance' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile label="Present" value={monthAtt.present} tone="success" />
            <StatTile label="Late" value={monthAtt.late} tone="warning" />
            <StatTile label="Absent" value={monthAtt.absent} tone="danger" />
            <StatTile label="Leave" value={monthAtt.leave} tone="primary" />
            <StatTile label="Hours" value={`${monthAtt.workingHours} h`} icon={Timer} />
          </div>

          <Card className="p-4">
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              cells={calendarCells}
              loading={calendarQuery.isFetching}
              legend={[
                { label: 'Present', color: 'var(--color-success)' },
                { label: 'Late', color: 'var(--color-warning)' },
                { label: 'Absent', color: 'var(--color-danger)' },
                { label: 'Leave', color: 'var(--color-cal-visit)' },
                { label: 'Holiday / off', color: 'var(--color-muted)' },
              ]}
            />
          </Card>
        </div>
      ) : null}

      {/* ── Leave ────────────────────────────────────────────────────────── */}
      {tab === 'leave' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Entitled"
              value={profile.leave.totals.entitled}
              hint={`${profile.leave.year} · paid types`}
              icon={CalendarDays}
            />
            <StatTile
              label="Used"
              value={profile.leave.totals.used}
              icon={Clock3}
              tone="primary"
            />
            <StatTile
              label="Pending approval"
              value={profile.leave.totals.pending}
              icon={TrendingUp}
              tone="warning"
            />
            <StatTile
              label="Remaining"
              value={profile.leave.totals.remaining}
              icon={CalendarDays}
              tone="success"
            />
          </div>

          <SectionCard
            title={`Balance — ${profile.leave.year}`}
            description="Used days come from approved requests only."
            icon={Clock3}
            actions={
              canGrantCompOff && !isSelf ? (
                <Button size="sm" variant="soft" onClick={() => setCompOffOpen(true)}>
                  <Gift size={13} />
                  Grant comp-off
                </Button>
              ) : null
            }
          >
            <div className="space-y-3.5">
              {profile.leave.balances.map((balance) => (
                <div key={balance.leaveTypeId}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="inline-flex min-w-0 items-center gap-2 font-semibold">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: balance.colorHex }}
                        aria-hidden
                      />
                      <span className="truncate">
                        {balance.code} · {balance.name}
                      </span>
                      {!balance.isPaid ? <Badge tone="neutral">Unpaid</Badge> : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--color-muted)]">
                      {balance.unlimited
                        ? `${balance.used} taken`
                        : `${balance.used} / ${balance.entitled}`}
                    </span>
                  </div>
                  <Meter
                    className="mt-1.5"
                    value={balance.used}
                    total={balance.unlimited ? balance.used : balance.entitled}
                    pending={balance.pending}
                    color={balance.colorHex}
                  />
                </div>
              ))}
              {paidBalances.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">
                  No paid leave types configured yet — set them up in Leave policy.
                </p>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Recent requests" icon={ClipboardList}>
            {profile.leave.recent.length === 0 ? (
              <EmptyState
                title="No leave taken"
                description="This employee has not applied for leave this year."
              />
            ) : (
              <ul className="divide-y divide-[var(--color-border)]/70">
                {profile.leave.recent.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          background: `color-mix(in srgb, ${row.colorHex} 14%, transparent)`,
                          color: row.colorHex,
                        }}
                      >
                        {row.leaveTypeCode}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {formatDisplayDate(row.fromDate)}
                          {row.fromDate !== row.toDate
                            ? ` → ${formatDisplayDate(row.toDate)}`
                            : ''}
                        </p>
                        <p className="truncate text-[11px] text-[var(--color-muted)]">
                          {row.reason}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-bold tabular-nums">{row.days}d</span>
                      <Badge tone={LEAVE_STATUS_TONE[row.status as LeaveStatus] ?? 'neutral'}>
                        {row.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      ) : null}

      {/* ── Employment & bank ────────────────────────────────────────────── */}
      {tab === 'records' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard title="Employment" icon={BriefcaseBusiness}>
            <dl>
              <DetailRow label="Employee code" value={profile.employment.employeeCode} mono />
              <DetailRow label="Designation" value={profile.employment.designation} />
              <DetailRow
                label="Joining date"
                value={
                  profile.employment.joiningDate
                    ? formatDisplayDate(profile.employment.joiningDate)
                    : null
                }
              />
              <DetailRow label="Tenure" value={tenureText(profile.employment.tenureMonths)} />
              <DetailRow label="Beat / area" value={profile.employment.assignedArea} />
              <DetailRow label="Territory" value={profile.territory?.name} />
              <DetailRow label="Reporting manager" value={profile.manager?.fullName} />
              <DetailRow
                label="Exit date"
                value={
                  profile.employment.exitDate
                    ? formatDisplayDate(profile.employment.exitDate)
                    : null
                }
              />
              <DetailRow label="Exit reason" value={profile.employment.exitReason} />
            </dl>
          </SectionCard>

          <SectionCard
            title="Statutory & payout"
            description="Needed for TA/DA settlement"
            icon={Landmark}
          >
            {canEdit || isSelf ? (
              <dl>
                <DetailRow label="PAN" value={profile.statutory.panNumber} mono />
                <DetailRow label="Aadhaar" value={profile.statutory.aadhaarNumber} mono />
                <DetailRow label="Bank" value={profile.statutory.bankName} />
                <DetailRow label="Account no." value={profile.statutory.bankAccountNo} mono />
                <DetailRow label="IFSC" value={profile.statutory.bankIfsc} mono />
              </dl>
            ) : (
              <div className="flex items-center gap-2 py-4 text-xs text-[var(--color-muted)]">
                <Banknote size={15} />
                Statutory details are visible to administrators only.
              </div>
            )}
          </SectionCard>
        </div>
      ) : null}

      <GrantCompOffDialog
        open={compOffOpen}
        onClose={() => setCompOffOpen(false)}
        employee={{ id: profile.id, fullName: profile.fullName }}
      />

      {/* ── Edit modal ───────────────────────────────────────────────────── */}
      <Modal
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setError(null);
        }}
        title="Edit employee record"
        description="HR details. Login, role and reporting line are managed from Users & Hierarchy."
        icon={PencilLine}
        className="max-w-2xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setEditOpen(false);
                setError(null);
              }}
            >
              Cancel
            </Button>
            <Button loading={updateMutation.isPending} onClick={() => updateMutation.mutate(edit)}>
              Save record
            </Button>
          </>
        }
      >
        {error ? <Alert message={error} /> : null}

        <FormSection title="Employment" icon={BriefcaseBusiness}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input
              label="Designation"
              value={edit.designation ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, designation: e.target.value }))}
              placeholder="Medical Representative"
            />
            <Input
              label="Beat / area"
              value={edit.assignedArea ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, assignedArea: e.target.value }))}
              placeholder="Andheri East"
            />
            <DatePicker
              label="Joining date"
              value={edit.joiningDate ?? ''}
              onChange={(value) => setEdit((f) => ({ ...f, joiningDate: value || null }))}
            />
            <DatePicker
              label="Exit date"
              value={edit.exitDate ?? ''}
              onChange={(value) => setEdit((f) => ({ ...f, exitDate: value || null }))}
            />
            <Textarea
              label="Exit reason"
              className="sm:col-span-2"
              value={edit.exitReason ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, exitReason: e.target.value }))}
              placeholder="Resigned — joined a competitor in Pune."
            />
          </div>
        </FormSection>

        <FormSection title="Personal" icon={UserRound}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <DatePicker
              label="Date of birth"
              value={edit.dob ?? ''}
              onChange={(value) => setEdit((f) => ({ ...f, dob: value || null }))}
            />
            <Select
              label="Gender"
              value={edit.gender ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, gender: e.target.value || null }))}
            >
              <option value="">Not specified</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </Select>
            <Input
              label="Blood group"
              value={edit.bloodGroup ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, bloodGroup: e.target.value }))}
              placeholder="B+"
            />
            <Input
              label="Marital status"
              value={edit.maritalStatus ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, maritalStatus: e.target.value }))}
              placeholder="Married"
            />
            <Input
              label="Qualification"
              value={edit.qualification ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, qualification: e.target.value }))}
              placeholder="B.Pharm"
            />
            <Input
              label="Emergency contact name"
              value={edit.emergencyName ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, emergencyName: e.target.value }))}
            />
            <Input
              label="Emergency contact phone"
              value={edit.emergencyPhone ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, emergencyPhone: e.target.value }))}
            />
            <Textarea
              label="Address"
              className="sm:col-span-2"
              value={edit.address ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, address: e.target.value }))}
            />
          </div>
        </FormSection>

        <FormSection title="Statutory & bank" subtitle="Used for TA/DA payouts" icon={Landmark}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            <Input
              label="PAN"
              value={edit.panNumber ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, panNumber: e.target.value.toUpperCase() }))}
              placeholder="ABCDE1234F"
            />
            <Input
              label="Aadhaar"
              value={edit.aadhaarNumber ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, aadhaarNumber: e.target.value }))}
            />
            <Input
              label="Bank name"
              value={edit.bankName ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, bankName: e.target.value }))}
            />
            <Input
              label="Account number"
              value={edit.bankAccountNo ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, bankAccountNo: e.target.value }))}
            />
            <Input
              label="IFSC"
              value={edit.bankIfsc ?? ''}
              onChange={(e) => setEdit((f) => ({ ...f, bankIfsc: e.target.value.toUpperCase() }))}
              placeholder="HDFC0001234"
            />
          </div>
        </FormSection>
      </Modal>
    </div>
  );
}
