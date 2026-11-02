import { cn } from '@/utils/cn';

const SIZES = {
  sm: 'w-12',
  md: 'w-20',
  lg: 'w-28',
};

/**
 * Jovance loader: the logo's gold J and red L, stacked so they form the mark
 * at rest, hop in turn, then the whole JL turns once. `index.html` draws the
 * same thing before React loads, so the hand-off is seamless.
 */
export function BrandLoader({
  size = 'md',
  label,
  className,
}: {
  size?: keyof typeof SIZES;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center gap-3', className)}
    >
      <div className={cn('brand-round relative aspect-[5/3]', SIZES[size])} aria-hidden>
        <img
          src="/jovance-j.png"
          alt=""
          draggable={false}
          className="brand-hop-j absolute inset-0 h-full w-full select-none"
        />
        <img
          src="/jovance-l.png"
          alt=""
          draggable={false}
          className="brand-hop-l absolute inset-0 h-full w-full select-none"
        />
      </div>
      {/* No visible caption — the animation says it; screen readers still hear the label. */}
      <span className="sr-only">{label ?? 'Loading'}</span>
    </div>
  );
}
