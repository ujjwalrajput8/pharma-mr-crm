import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/store/AuthContext';
import { AppLayout } from '@/layouts/AppLayout';
import { GuestRoute, ProtectedRoute, RequirePermission } from '@/routes/guards';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { UsersPage } from '@/pages/UsersPage';
import { DoctorsPage } from '@/pages/DoctorsPage';
import { DoctorDetailPage } from '@/pages/DoctorDetailPage';
import { StoresPage } from '@/pages/StoresPage';
import { MedicinesPage } from '@/pages/MedicinesPage';
import { MedicineDetailPage } from '@/pages/MedicineDetailPage';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { VisitsPage } from '@/pages/VisitsPage';
import { StockPage } from '@/pages/StockPage';
import { DistributionsPage } from '@/pages/DistributionsPage';
import { MedicineIssuesPage } from '@/pages/MedicineIssuesPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SalesPage } from '@/pages/SalesPage';
import { AttendancePage } from '@/pages/AttendancePage';
import { SettingsPage } from '@/pages/SettingsPage';
import { AuditLogsPage } from '@/pages/AuditLogsPage';
import { MyDayPage } from '@/pages/MyDayPage';
import { ApprovalsPage } from '@/pages/ApprovalsPage';
import { TourPlanPage } from '@/pages/TourPlanPage';
import { MyStockPage } from '@/pages/MyStockPage';
import { LedgerPage } from '@/pages/LedgerPage';
import { ManagerPermissionsPage } from '@/pages/ManagerPermissionsPage';
import { LeavePage } from '@/pages/LeavePage';
import { LeavePolicyPage } from '@/pages/LeavePolicyPage';
import { HolidaysPage } from '@/pages/HolidaysPage';
import { EmployeesPage } from '@/pages/EmployeesPage';
import { EmployeeProfilePage } from '@/pages/EmployeeProfilePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<GuestRoute />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />

                <Route
                  path="/dashboard"
                  element={
                    <RequirePermission permissions={['dashboard:view']}>
                      <DashboardPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/my-day"
                  element={
                    <RequirePermission permissions={['myday:own']}>
                      <MyDayPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/approvals"
                  element={
                    <RequirePermission permissions={['approvals:team']}>
                      <ApprovalsPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/tour-plan"
                  element={
                    <RequirePermission permissions={['tour-plan:manage', 'tour-plan:own']}>
                      <TourPlanPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/leave"
                  element={
                    <RequirePermission permissions={['leaves:own', 'leaves:manage']}>
                      <LeavePage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/employees"
                  element={
                    <RequirePermission permissions={['employees:view']}>
                      <EmployeesPage />
                    </RequirePermission>
                  }
                />
                {/* Own record is reachable for every role — the page falls back to /employees/me. */}
                <Route
                  path="/employees/:id"
                  element={
                    <RequirePermission permissions={['employees:view', 'profile:own']}>
                      <EmployeeProfilePage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/holidays"
                  element={
                    <RequirePermission permissions={['holidays:manage']}>
                      <HolidaysPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/leave-policy"
                  element={
                    <RequirePermission permissions={['leave-types:manage']}>
                      <LeavePolicyPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/my-stock"
                  element={
                    <RequirePermission permissions={['mystock:own']}>
                      <MyStockPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/ledger"
                  element={
                    <RequirePermission permissions={['ledger:view']}>
                      <LedgerPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/users"
                  element={
                    <RequirePermission permissions={['users:manage']}>
                      <UsersPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/manager-permissions"
                  element={
                    <RequirePermission permissions={['users:manage']}>
                      <ManagerPermissionsPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/doctors"
                  element={
                    <RequirePermission permissions={['doctors:manage', 'doctors:own']}>
                      <DoctorsPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/doctors/:id"
                  element={
                    <RequirePermission permissions={['doctors:manage', 'doctors:own']}>
                      <DoctorDetailPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/stores"
                  element={
                    <RequirePermission permissions={['stores:manage']}>
                      <StoresPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/medicines"
                  element={
                    <RequirePermission permissions={['medicines:manage']}>
                      <MedicinesPage />
                    </RequirePermission>
                  }
                />
                <Route
                  path="/medicines/:id"
                  element={
                    <RequirePermission permissions={['medicines:manage']}>
                      <MedicineDetailPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/appointments"
                  element={
                    <RequirePermission permissions={['appointments:manage', 'appointments:own']}>
                      <AppointmentsPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/visits"
                  element={
                    <RequirePermission permissions={['visits:manage', 'visits:own']}>
                      <VisitsPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/distributions"
                  element={
                    <RequirePermission permissions={['distributions:manage', 'distributions:own']}>
                      <DistributionsPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/medicine-issues"
                  element={
                    <RequirePermission permissions={['medicine-issues:manage', 'medicine-issues:own']}>
                      <MedicineIssuesPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/sales"
                  element={
                    <RequirePermission permissions={['sales:manage', 'sales:own']}>
                      <SalesPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/attendance"
                  element={
                    <RequirePermission permissions={['attendance:manage', 'attendance:own']}>
                      <AttendancePage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/stock"
                  element={
                    <RequirePermission permissions={['stock:manage']}>
                      <StockPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/reports"
                  element={
                    <RequirePermission permissions={['reports:all', 'reports:own']}>
                      <ReportsPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/settings"
                  element={
                    <RequirePermission permissions={['settings:manage']}>
                      <SettingsPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/audit-logs"
                  element={
                    <RequirePermission permissions={['audit:view']}>
                      <AuditLogsPage />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/profile"
                  element={
                    <RequirePermission permissions={['profile:own']}>
                      <ProfilePage />
                    </RequirePermission>
                  }
                />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
