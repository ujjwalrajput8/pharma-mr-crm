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
import { StoresPage } from '@/pages/StoresPage';
import { MedicinesPage } from '@/pages/MedicinesPage';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { VisitsPage } from '@/pages/VisitsPage';
import { StockPage } from '@/pages/StockPage';
import { DistributionsPage } from '@/pages/DistributionsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';

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
                  path="/users"
                  element={
                    <RequirePermission permissions={['users:manage']}>
                      <UsersPage />
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
                      <PlaceholderPage
                        title="Settings"
                        description="Organization-level application settings."
                      />
                    </RequirePermission>
                  }
                />

                <Route
                  path="/audit-logs"
                  element={
                    <RequirePermission permissions={['audit:view']}>
                      <PlaceholderPage
                        title="Audit Logs"
                        description="Security and change history for administrators."
                      />
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
