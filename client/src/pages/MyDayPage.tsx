import { Link } from 'react-router-dom';
import { CalendarCheck2, ClipboardList, Clock3, Sun } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NotWiredYet } from '@/components/ui/NotWiredYet';
import { PageHeader } from '@/components/ui/Page';

export function MyDayPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="My Day"
        description="Check-in → today's call list → visit / DCR → day close."
      />

      <NotWiredYet
        icon={Sun}
        title="The daily call list needs the tour plan API"
        summary="My Day pulls today's doctors from the approved monthly tour plan. Until that API exists, use Attendance for check-in and Appointments for today's visits."
        planned={[
          'Call list generated from the approved tour plan for today',
          'Start a visit inline and file the DCR without leaving the page',
          'Samples given during a visit post straight to the stock ledger',
          'Day close that locks the day and submits it for manager review',
        ]}
        ready={[
          'GPS check-in / check-out with late and flag detection',
          'tour_plans, tour_plan_days and tour_plan_calls tables',
          'Appointment → visit → sample flow (Appointments page)',
          'Visit.lockedAt column for the day-close lock',
        ]}
        footer={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to="/attendance">
              <Button variant="secondary" size="sm">
                <Clock3 size={14} />
                Check in from Attendance
              </Button>
            </Link>
            <Link to="/appointments">
              <Button variant="secondary" size="sm">
                <CalendarCheck2 size={14} />
                Today's appointments
              </Button>
            </Link>
            <Link to="/visits">
              <Button variant="secondary" size="sm">
                <ClipboardList size={14} />
                Visits / DCR
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
