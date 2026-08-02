import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  Package,
  Stethoscope,
  Store,
  Users,
  Pill,
  AlertTriangle,
} from 'lucide-react';
import { Card, PageHeader } from '@/components/ui/Page';
import { useAuth } from '@/store/AuthContext';
import { dashboardApi } from '@/services/dashboard.service';

const adminMeta: Record<string, { label: string; to: string; icon: typeof Users }> = {
  totalMrs: { label: 'Total MRs', to: '/users', icon: Users },
  totalDoctors: { label: 'Total Doctors', to: '/doctors', icon: Stethoscope },
  totalStores: { label: 'Medical Stores', to: '/stores', icon: Store },
  totalMedicines: { label: 'Medicines', to: '/medicines', icon: Pill },
  todaysAppointments: { label: "Today's Appointments", to: '/appointments', icon: CalendarDays },
  todaysVisits: { label: "Today's Visits", to: '/visits', icon: ClipboardList },
  pendingAppointments: { label: 'Pending Appointments', to: '/appointments', icon: CalendarDays },
  lowStockCount: { label: 'Low Stock Alerts', to: '/stock', icon: AlertTriangle },
};

const mrMeta: Record<string, { label: string; to: string; icon: typeof Users }> = {
  todaysAppointments: { label: "Today's Appointments", to: '/appointments', icon: CalendarDays },
  todaysVisits: { label: "Today's Visits", to: '/visits', icon: ClipboardList },
  pendingFollowUps: { label: 'Pending Follow-ups', to: '/visits', icon: ClipboardList },
  assignedDoctors: { label: 'Assigned Doctors', to: '/doctors', icon: Stethoscope },
  pendingAppointments: { label: 'Pending Appointments', to: '/appointments', icon: CalendarDays },
};

export function DashboardPage() {
  const { user } = useAuth();
  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary'],
    queryFn: () => dashboardApi.summary(),
  });

  const meta = user?.role === 'ADMIN' ? adminMeta : mrMeta;
  const cards = summaryQuery.data?.cards ?? {};

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, ${user?.fullName}. Live ${
          user?.role === 'ADMIN' ? 'organization' : 'field'
        } overview.`}
      />

      {summaryQuery.isLoading ? (
        <Card className="p-8 text-sm text-[var(--color-muted)]">Loading dashboard…</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(meta).map(([key, item]) => {
            const Icon = item.icon;
            const value = cards[key] ?? 0;
            return (
              <Link key={key} to={item.to}>
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]">
                  <div className="mb-3 inline-flex rounded-xl bg-[var(--color-primary-soft)] p-2.5 text-[var(--color-primary)]">
                    <Icon size={18} />
                  </div>
                  <p className="text-sm text-[var(--color-muted)]">{item.label}</p>
                  <p className="mt-1 text-3xl font-semibold text-[var(--color-ink)]">{value}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {user?.role === 'ADMIN' ? (
        <Card className="flex items-center gap-3 p-5">
          <Package className="text-[var(--color-primary)]" size={20} />
          <div>
            <p className="font-medium">Stock & Reports</p>
            <p className="text-sm text-[var(--color-muted)]">
              Monitor inventory alerts and upcoming field activity from the modules above.
            </p>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
