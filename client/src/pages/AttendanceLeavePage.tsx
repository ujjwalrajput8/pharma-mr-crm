import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CalendarCheck2, Clock3, FileSliders, Inbox, LayoutDashboard, PartyPopper } from 'lucide-react';
import { ApprovalsTab, type ApprovalKind } from '@/components/attendance-leave/ApprovalsTab';
import { LeaveApplyDialog } from '@/components/attendance-leave/LeaveApplyDialog';
import { OverviewTab } from '@/components/attendance-leave/OverviewTab';
import { EmbeddedPage, PageHeader } from '@/components/ui/Page';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { AttendancePage } from '@/pages/AttendancePage';
import { HolidaysPage } from '@/pages/HolidaysPage';
import { LeavePage } from '@/pages/LeavePage';
import { LeavePolicyPage } from '@/pages/LeavePolicyPage';
import { useAuth } from '@/store/AuthContext';

export type AttendanceLeaveTab = 'overview' | 'attendance' | 'leave' | 'approvals' | 'holidays' | 'policy';

const APPROVAL_KINDS: ApprovalKind[] = ['leave', 'regularization', 'flagged'];

/**
 * One module for attendance, leave, approvals, holidays and leave policy. The tab
 * lives in the URL (`?tab=leave`) so links, bookmarks and notifications land on it;
 * each tab is the existing screen, shown without its own page title.
 */
export function AttendanceLeavePage() {
  const { can, role } = useAuth();
  const [params, setParams] = useSearchParams();
  const [apply, setApply] = useState<{ open: boolean; date?: string }>({ open: false });

  const tabs: Array<TabItem<AttendanceLeaveTab>> = [
    { value: 'overview', label: 'Overview', icon: LayoutDashboard },
    ...(can('attendance:own') || can('attendance:manage')
      ? [{ value: 'attendance' as const, label: role === 'ADMIN' ? 'Attendance' : 'My Attendance', icon: Clock3 }]
      : []),
    ...(can('leaves:own') || can('leaves:manage') ? [{ value: 'leave' as const, label: 'Leave', icon: CalendarCheck2 }] : []),
    ...(can('leaves:manage') || can('attendance:manage')
      ? [{ value: 'approvals' as const, label: 'Approvals', icon: Inbox }]
      : []),
    { value: 'holidays', label: 'Holiday Calendar', icon: PartyPopper },
    ...(can('leave-types:manage') ? [{ value: 'policy' as const, label: 'Policy', icon: FileSliders }] : []),
  ];

  const requested = params.get('tab') as AttendanceLeaveTab | null;
  const tab: AttendanceLeaveTab = tabs.some((item) => item.value === requested) ? requested! : 'overview';

  // A tab this person may not open (e.g. an MR following an approvals link) falls back to Overview.
  useEffect(() => {
    if (requested && requested !== tab) setParams({ tab }, { replace: true });
  }, [requested, tab, setParams]);

  const go = (next: AttendanceLeaveTab) => setParams({ tab: next });
  const openApply = (date?: string) => setApply({ open: true, date });
  const kind = params.get('type') as ApprovalKind | null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance & Leave"
        description="Attendance, leave, approvals and the holiday calendar in one place."
      />
      <Tabs items={tabs} value={tab} onChange={go} />

      <EmbeddedPage>
        {tab === 'overview' ? <OverviewTab onNavigate={go} onApplyLeave={() => openApply()} /> : null}
        {tab === 'attendance' ? <AttendancePage onApplyLeave={openApply} /> : null}
        {tab === 'leave' ? <LeavePage /> : null}
        {tab === 'approvals' ? (
          <ApprovalsTab initialKind={kind && APPROVAL_KINDS.includes(kind) ? kind : 'leave'} />
        ) : null}
        {tab === 'holidays' ? <HolidaysPage /> : null}
        {tab === 'policy' ? <LeavePolicyPage /> : null}
      </EmbeddedPage>

      <LeaveApplyDialog open={apply.open} initialDate={apply.date} onClose={() => setApply({ open: false })} />
    </div>
  );
}
