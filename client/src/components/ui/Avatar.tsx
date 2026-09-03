import { cn } from '@/utils/cn';

const PALETTE = [
  { bg: 'rgba(15,118,110,0.14)', fg: '#0f766e' },
  { bg: 'rgba(37,99,235,0.14)', fg: '#2563eb' },
  { bg: 'rgba(217,119,6,0.16)', fg: '#b45309' },
  { bg: 'rgba(219,39,119,0.14)', fg: '#be185d' },
  { bg: 'rgba(124,58,237,0.14)', fg: '#6d28d9' },
  { bg: 'rgba(5,150,105,0.14)', fg: '#047857' },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Deterministic colour so the same person keeps the same chip everywhere. */
function paletteFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return PALETTE[hash % PALETTE.length]!;
}

const sizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
  xl: 'h-16 w-16 text-lg',
};

export function Avatar({
  name,
  photoUrl,
  size = 'md',
  className,
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const palette = paletteFor(name);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className={cn(
          'shrink-0 rounded-full border border-[var(--color-border)] object-cover',
          sizes[size],
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      title={name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold tracking-tight select-none',
        sizes[size],
        className,
      )}
      style={{ background: palette.bg, color: palette.fg }}
    >
      {initials(name)}
    </span>
  );
}
