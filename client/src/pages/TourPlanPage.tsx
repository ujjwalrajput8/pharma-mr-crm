import { Link } from 'react-router-dom';
import { CalendarCheck2, Map, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { NotWiredYet } from '@/components/ui/NotWiredYet';
import { PageHeader } from '@/components/ui/Page';

export function TourPlanPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="Tour plan"
        description="Monthly plan → manager approval → day-wise call list."
      />

      <NotWiredYet
        icon={Map}
        title="Monthly tour plan (MTP) is next up"
        summary="The database models are already designed and migrated — what is missing is the API and the planning grid. Territory master needs CRUD first, since a plan day is beat-wise."
        planned={[
          'Month grid: pick a beat and the doctors / chemists to call each day',
          'Draft → Submit → manager Approve / Reject, then locked',
          'Joint-work days tagged with the accompanying manager',
          'Approved plan feeds My Day and the coverage-compliance report',
        ]}
        ready={[
          'tour_plans, tour_plan_days, tour_plan_calls tables + status enum',
          'Territory tree model (STATE / DISTRICT / HQ / BEAT)',
          'Doctor assignment per MR, with visit frequency and category',
          'Approvals inbox that the submitted plan will land in',
        ]}
        footer={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Link to="/doctors">
              <Button variant="secondary" size="sm">
                <Stethoscope size={14} />
                Assigned doctors
              </Button>
            </Link>
            <Link to="/appointments">
              <Button variant="secondary" size="sm">
                <CalendarCheck2 size={14} />
                Plan via appointments
              </Button>
            </Link>
          </div>
        }
      />
    </div>
  );
}
