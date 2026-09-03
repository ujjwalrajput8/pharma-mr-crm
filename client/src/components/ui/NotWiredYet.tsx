import type { ComponentType, ReactNode } from 'react';
import { Check, Construction } from 'lucide-react';
import { Card } from '@/components/ui/Page';

/**
 * Honest placeholder for a screen whose backend is not built yet.
 *
 * These screens used to render invented rows (fake doctor names, fake rupee
 * amounts) which is dangerous on a live deployment — nobody can tell demo data
 * from real data. Say plainly what is missing instead.
 */
export function NotWiredYet({
  icon: Icon = Construction,
  title,
  summary,
  planned,
  ready,
  footer,
}: {
  icon?: ComponentType<{ size?: number; className?: string }>;
  /** What this screen will do, in one line. */
  title: string;
  summary: string;
  /** Bullets describing the intended behaviour. */
  planned?: string[];
  /** Groundwork that already exists (e.g. DB models), so the gap is clear. */
  ready?: string[];
  footer?: ReactNode;
}) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="mx-auto max-w-xl text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
          <Icon size={26} />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-warning)]/25 bg-[var(--color-warning-soft)] px-3 py-1 text-[11px] font-bold tracking-wider text-[var(--color-warning)] uppercase">
          Backend not connected
        </span>
        <h3 className="mt-3 text-lg font-bold tracking-tight text-[var(--color-ink)]">{title}</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-[var(--color-muted)]">
          {summary}
        </p>
      </div>

      {planned || ready ? (
        <div className="mx-auto mt-6 grid max-w-2xl gap-4 text-left sm:grid-cols-2">
          {planned ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)]/60 p-4">
              <p className="text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                Planned here
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {planned.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-ink)]"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-border-strong)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {ready ? (
            <div className="rounded-[var(--radius-sm)] border border-[var(--color-success)]/25 bg-[var(--color-success-soft)]/60 p-4">
              <p className="text-[11px] font-bold tracking-wider text-[var(--color-success)] uppercase">
                Already in place
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {ready.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2 text-xs leading-relaxed text-[var(--color-ink)]"
                  >
                    <Check
                      size={13}
                      className="mt-0.5 shrink-0 text-[var(--color-success)]"
                      aria-hidden
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {footer ? (
        <div className="mx-auto mt-6 max-w-2xl border-t border-[var(--color-border)] pt-4">
          {footer}
        </div>
      ) : null}
    </Card>
  );
}
