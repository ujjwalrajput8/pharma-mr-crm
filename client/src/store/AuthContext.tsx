import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { authApi } from '@/services/auth.service';
import { tokenStorage } from '@/api/client';
import type { AuthUser, Permission, Role } from '@/types';
import { hasAnyPermission, hasPermission } from '@/utils/permissions';

function normalizeRole(role: string): Role {
  if (role === 'MANAGER' || role === 'MR' || role === 'ADMIN') return role;
  return 'MR';
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  role: Role | null;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      const token = tokenStorage.get();
      if (!token) {
        if (!cancelled) setIsBootstrapping(false);
        return;
      }

      try {
        const me = await authApi.me();
        if (!cancelled) {
          setUser({
            ...me,
            role: normalizeRole(me.role),
            permissions: me.permissions,
          });
        }
      } catch {
        tokenStorage.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const session = await authApi.login(email, password);
    tokenStorage.set(session.accessToken);
    const role = normalizeRole(session.user.role);
    setUser({ ...session.user, role, permissions: session.user.permissions });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      tokenStorage.clear();
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const role = user?.role ?? null;
    const permissions = user?.permissions;
    return {
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      logout,
      role,
      can: (permission) => hasPermission(role, permission, permissions),
      canAny: (needed) => hasAnyPermission(role, needed, permissions),
    };
  }, [user, isBootstrapping, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
