import type { ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '@/components/ui/Page';
import { Skeleton } from '@/components/ui/Skeleton';
import type { DashboardTrends } from '@/services/dashboard.service';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';

/**
 * Chart color tokens — the validated reference palette (dataviz skill), stepped
 * per theme, with chrome hexes matching the app's --color-* pairs in index.css.
 * Hardcoded pairs because SVG presentation attributes can't resolve CSS vars.
 * Both palettes pass the 6-check validator against the app's surfaces.
 */
interface ChartTokens {
  series1: string;
  series2: string;
  grid: string;
  axis: string;
  tick: string;
  ink: string;
  muted: string;
  surface: string;
  track: string;
  cursor: string;
  tooltipBg: string;
  tooltipBorder: string;
}

const CHART_TOKENS: Record<'light' | 'dark', ChartTokens> = {
  light: {
    series1: '#2a78d6',
    series2: '#eb6834',
    grid: '#e2e8f0',
    axis: '#cbd5e1',
    tick: '#64748b',
    ink: '#0f172a',
    muted: '#64748b',
    surface: '#ffffff',
    track: '#e2e8f0',
    cursor: 'rgba(15, 23, 42, 0.05)',
    tooltipBg: '#ffffff',
    tooltipBorder: '#cbd5e1',
  },
  dark: {
    series1: '#3987e5',
    series2: '#d95926',
    grid: '#1e293b',
    axis: '#334155',
    tick: '#94a3b8',
    ink: '#f1f5f9',
    muted: '#94a3b8',
    surface: '#0f1623',
    track: '#1e293b',
    cursor: 'rgba(148, 163, 184, 0.1)',
    tooltipBg: '#172032',
    tooltipBorder: '#334155',
  },
};

const COMPACT_INR = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const FULL_INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function shortDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function longDay(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function truncateLabel(value: string): string {
  return value.length > 14 ? `${value.slice(0, 13)}…` : value;
}

interface TooltipRow {
  name?: string | number;
  dataKey?: string | number;
  value?: string | number;
  color?: string;
  payload?: { fill?: string } & Record<string, unknown>;
}

/** Shared tooltip — app surface/ink tokens so it stays readable in dark theme. */
function ChartTooltip({
  active,
  payload,
  label,
  tokens,
  labelFormatter,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: string | number;
  tokens: ChartTokens;
  labelFormatter?: (label: string) => string;
  valueFormatter?: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      className="rounded-lg border px-2.5 py-2 shadow-lg"
      style={{ background: tokens.tooltipBg, borderColor: tokens.tooltipBorder }}
    >
      {label !== undefined && label !== '' ? (
        <p className="mb-1 text-[11px] font-bold" style={{ color: tokens.ink }}>
          {labelFormatter ? labelFormatter(String(label)) : String(label)}
        </p>
      ) : null}
      {payload.map((row, index) => (
        <p
          key={`${String(row.dataKey ?? row.name ?? index)}`}
          className="flex items-center gap-1.5 text-[11px] font-medium"
          style={{ color: tokens.muted }}
        >
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-[3px]"
            style={{ background: row.color ?? row.payload?.fill ?? tokens.series1 }}
          />
          <span>{String(row.name ?? '')}:</span>
          <span className="font-bold tabular-nums" style={{ color: tokens.ink }}>
            {valueFormatter
              ? valueFormatter(Number(row.value ?? 0))
              : Number(row.value ?? 0).toLocaleString('en-IN')}
          </span>
        </p>
      ))}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--color-muted)]">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function ChartCard({
  title,
  caption,
  legend,
  children,
}: {
  title: string;
  caption: string;
  legend?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-[var(--color-ink)]">{title}</h3>
          <p className="text-[11px] text-[var(--color-muted)]">{caption}</p>
        </div>
        {legend ? <div className="flex flex-wrap items-center gap-3">{legend}</div> : null}
      </div>
      {children}
    </Card>
  );
}

function EmptyNote({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg)]/40">
      <p className="max-w-[80%] text-center text-xs font-medium text-[var(--color-muted)]">
        {message}
      </p>
    </div>
  );
}

function ChartCardSkeleton() {
  return (
    <Card className="p-5">
      <Skeleton className="h-3.5 w-40" />
      <Skeleton className="mt-1.5 h-2.5 w-24" />
      <Skeleton className="mt-3 h-[240px] w-full" />
    </Card>
  );
}

/**
 * The dashboard charts row: visits & appointments trend, sales by day,
 * doctor coverage donut, and a role-picked fourth chart (top sampled medicines
 * for MRs, leave mix for managers/admins). Single trends payload in, no extra
 * queries here.
 */
export function DashboardCharts({
  trends,
  isLoading,
}: {
  trends?: DashboardTrends;
  isLoading: boolean;
}) {
  const { theme } = useTheme();
  const { role } = useAuth();
  const t = CHART_TOKENS[theme];

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
    );
  }

  if (!trends) {
    return (
      <Card className="p-5">
        <EmptyNote message="Trend charts couldn't load right now — refresh to try again." />
      </Card>
    );
  }

  const caption = `Last ${trends.days} days · ${shortDay(trends.from)} – ${shortDay(trends.to)}`;
  const hasActivity = trends.visitsByDay.some((d) => d.visits > 0 || d.appointments > 0);
  const hasSales = trends.salesByDay.some((d) => d.amount > 0);
  const { visited, total } = trends.doctorCoverage;
  const notVisited = Math.max(total - visited, 0);
  const coveragePct = total > 0 ? Math.round((visited / total) * 100) : 0;
  const showLeaveMix = role === 'ADMIN' || role === 'MANAGER';
  const leaveTotal = trends.leaveDistribution.reduce((sum, row) => sum + row.days, 0);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* (a) Visits & appointments — two series, legend always on. */}
      <ChartCard
        title="Visits & appointments"
        caption={caption}
        legend={
          <>
            <LegendDot color={t.series1} label="Visits" />
            <LegendDot color={t.series2} label="Appointments" />
          </>
        }
      >
        {hasActivity ? (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends.visitsByDay} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={t.grid} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDay}
                  tick={{ fill: t.tick, fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: t.axis }}
                  minTickGap={28}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  width={32}
                  tick={{ fill: t.tick, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ stroke: t.axis }}
                  content={<ChartTooltip tokens={t} labelFormatter={longDay} />}
                />
                <Area
                  type="monotone"
                  dataKey="visits"
                  name="Visits"
                  stroke={t.series1}
                  strokeWidth={2}
                  fill={t.series1}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="appointments"
                  name="Appointments"
                  stroke={t.series2}
                  strokeWidth={2}
                  fill={t.series2}
                  fillOpacity={0.1}
                  dot={false}
                  activeDot={{ r: 4, stroke: t.surface, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyNote message="No visits or appointments recorded in this period yet." />
        )}
      </ChartCard>

      {/* (b) Sales by day — single series, ₹ compact ticks. */}
      <ChartCard title="Sales by day" caption={caption}>
        {hasSales ? (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trends.salesByDay} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={t.grid} />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDay}
                  tick={{ fill: t.tick, fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: t.axis }}
                  minTickGap={28}
                  interval="preserveStartEnd"
                />
                <YAxis
                  width={46}
                  tick={{ fill: t.tick, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value: number) => `₹${COMPACT_INR.format(value)}`}
                />
                <Tooltip
                  cursor={{ fill: t.cursor }}
                  content={
                    <ChartTooltip
                      tokens={t}
                      labelFormatter={longDay}
                      valueFormatter={(value) => `₹${FULL_INR.format(value)}`}
                    />
                  }
                />
                <Bar
                  dataKey="amount"
                  name="Sales"
                  fill={t.series1}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyNote message="No sales booked in this period yet." />
        )}
      </ChartCard>

      {/* (c) Doctor coverage — donut with % centre label. */}
      <ChartCard
        title="Doctor coverage"
        caption={caption}
        legend={
          <>
            <LegendDot color={t.series1} label="Visited" />
            <LegendDot color={t.track} label="Not yet" />
          </>
        }
      >
        {total > 0 ? (
          <div className="relative h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<ChartTooltip tokens={t} />} />
                <Pie
                  data={[
                    { name: 'Visited', value: visited },
                    { name: 'Not yet visited', value: notVisited },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="92%"
                  startAngle={90}
                  endAngle={-270}
                  stroke={t.surface}
                  strokeWidth={2}
                  isAnimationActive={false}
                >
                  <Cell fill={t.series1} />
                  <Cell fill={t.track} />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold tracking-tight text-[var(--color-ink)]">
                {coveragePct}%
              </span>
              <span className="mt-0.5 text-[11px] font-medium text-[var(--color-muted)]">
                {visited.toLocaleString('en-IN')} of {total.toLocaleString('en-IN')} doctors
              </span>
            </div>
          </div>
        ) : (
          <EmptyNote message="No active doctors in your scope yet." />
        )}
      </ChartCard>

      {/* (d) Role-picked: leave mix for managers/admins, top medicines for MRs. */}
      {showLeaveMix ? (
        <ChartCard title="Leave mix" caption={`Approved leaves · ${caption}`}>
          {trends.leaveDistribution.length > 0 ? (
            <div className="flex h-[240px] items-center gap-4">
              <div className="h-full w-[180px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      content={
                        <ChartTooltip
                          tokens={t}
                          valueFormatter={(value) =>
                            `${value.toLocaleString('en-IN', { maximumFractionDigits: 1 })} days`
                          }
                        />
                      }
                    />
                    <Pie
                      data={trends.leaveDistribution.map((row) => ({
                        name: row.name,
                        value: row.days,
                        fill: row.colorHex,
                      }))}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="62%"
                      outerRadius="90%"
                      startAngle={90}
                      endAngle={-270}
                      stroke={t.surface}
                      strokeWidth={2}
                      isAnimationActive={false}
                    >
                      {trends.leaveDistribution.map((row) => (
                        <Cell key={row.code} fill={row.colorHex} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-2 overflow-y-auto">
                {trends.leaveDistribution.map((row) => (
                  <li key={row.code} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex min-w-0 items-center gap-1.5 font-semibold text-[var(--color-ink)]">
                      <span
                        aria-hidden
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: row.colorHex }}
                      />
                      <span className="truncate">{row.name}</span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-[var(--color-muted)]">
                      {row.days.toLocaleString('en-IN', { maximumFractionDigits: 1 })}d
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] pt-2 text-xs">
                  <span className="font-semibold text-[var(--color-muted)]">Total</span>
                  <span className="font-bold tabular-nums text-[var(--color-ink)]">
                    {leaveTotal.toLocaleString('en-IN', { maximumFractionDigits: 1 })}d
                  </span>
                </li>
              </ul>
            </div>
          ) : (
            <EmptyNote message="No approved leaves in this period." />
          )}
        </ChartCard>
      ) : (
        <ChartCard title="Top sampled medicines" caption={caption}>
          {trends.topMedicines.length > 0 ? (
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={trends.topMedicines}
                  layout="vertical"
                  margin={{ top: 4, right: 36, left: 4, bottom: 4 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={112}
                    tick={{ fill: t.tick, fontSize: 10.5 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={truncateLabel}
                  />
                  <Tooltip
                    cursor={{ fill: t.cursor }}
                    content={
                      <ChartTooltip
                        tokens={t}
                        valueFormatter={(value) => `${value.toLocaleString('en-IN')} units`}
                      />
                    }
                  />
                  <Bar
                    dataKey="qty"
                    name="Samples"
                    fill={t.series1}
                    radius={[0, 4, 4, 0]}
                    maxBarSize={18}
                  >
                    <LabelList dataKey="qty" position="right" fill={t.ink} fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyNote message="No samples distributed in this period yet." />
          )}
        </ChartCard>
      )}
    </div>
  );
}
