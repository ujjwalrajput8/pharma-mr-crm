import { LogOut, Menu } from 'lucide-react';
import { useAuth } from '@/store/AuthContext';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function Header({ onToggleSidebar }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-white/90 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          className="!px-2.5 !py-2 lg:hidden"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
        >
          <Menu size={18} />
        </Button>
        <div>
          <p className="text-xs text-[var(--color-muted)]">Workspace</p>
          <p className="font-medium text-[var(--color-ink)]">{user?.fullName}</p>
        </div>
      </div>

      <Button variant="secondary" onClick={() => void logout()}>
        <LogOut size={16} />
        Logout
      </Button>
    </header>
  );
}
