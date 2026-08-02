import { Toaster, toast as sonnerToast } from 'sonner';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useTheme } from '@/store/ThemeContext';

type ToastApi = {
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { theme } = useTheme();

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) =>
        sonnerToast.success(title, { description, duration: 3500 }),
      error: (title, description) =>
        sonnerToast.error(title, { description, duration: 4500 }),
      info: (title, description) =>
        sonnerToast.message(title, { description, duration: 3500 }),
      warning: (title, description) =>
        sonnerToast.warning(title, { description, duration: 4000 }),
    }),
    [],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <Toaster
        theme={theme === 'dark' ? 'dark' : 'light'}
        position="top-right"
        richColors
        closeButton
        expand={false}
        toastOptions={{
          classNames: {
            toast: 'border border-[var(--color-border)] shadow-[var(--shadow-md)]',
          },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
