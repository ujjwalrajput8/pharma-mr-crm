import { cn } from '@/utils/cn';

/**
 * Horizontal usage bar — used for leave balance (used / entitled) and any
 * other "x of y consumed" figure. A second segment shows pending amounts.
 */
export function Meter({
  value,
  total,
  pending = 0,
  color = 'var(--color-primary)',
  className,
}: {
  value: number;
  total: number;
  pending?: number;
  color?: string;
  className?: string;
}) {
  const safeTotal = total > 0 ? total : Math.max(value + pending, 1);
  const usedPct = Math.min(100, (value / safeTotal) * 100);
  const pendingPct = Math.min(100 - usedPct, (pending / safeTotal) * 100);

  return (
    <div
      className={cn(
        'flex h-2 w-full overflow-hidden rounded-full bg-[var(--color-border)]/70',
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={safeTotal}
    >
      <span
        className="h-full rounded-l-full transition-[width] duration-500"
        style={{ width: `${usedPct}%`, background: color }}
      />
      {pendingPct > 0 ? (
        <span
          className="h-full transition-[width] duration-500"
          style={{
            width: `${pendingPct}%`,
            background: `repeating-linear-gradient(45deg, ${color}, ${color} 3px, transparent 3px, transparent 6px)`,
            opacity: 0.65,
          }}
          title="Pending approval"
        />
      ) : null}
    </div>
  );
}
