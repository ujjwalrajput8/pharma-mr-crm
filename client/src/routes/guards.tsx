import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/store/AuthContext';
import type { Permission } from '@/types';

function BootstrappingScreen() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-[var(--color-bg)] text-[var(--color-muted)]">
      Loading session…
    </div>
  );
}

export function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <BootstrappingScreen />;
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth();

  if (isBootstrapping) return <BootstrappingScreen />;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function RequirePermission({
  permissions,
  children,
}: {
  permissions: Permission[];
  children: ReactNode;
}) {
  const { canAny } = useAuth();

  if (!canAny(permissions)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
