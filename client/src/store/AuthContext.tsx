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
        if (!cancelled) setUser(me);
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
    setUser(session.user);
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
    return {
      user,
      isAuthenticated: Boolean(user),
      isBootstrapping,
      login,
      logout,
      role,
      can: (permission) => (role ? hasPermission(role, permission) : false),
      canAny: (permissions) => (role ? hasAnyPermission(role, permissions) : false),
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
