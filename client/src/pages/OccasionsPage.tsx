import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Stethoscope, Users } from 'lucide-react';
import { OccasionRow } from '@/components/dashboard/UpcomingOccasions';
import { Input, Select } from '@/components/ui/Field';
import { Alert, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { getApiErrorMessage } from '@/api/client';
import { useAuth } from '@/store/AuthContext';
import { dashboardApi, type Occasion } from '@/services/dashboard.service';
import { parseIsoDate } from '@/utils/datetime';

type TypeFilter = 'ALL' | 'DOCTOR' | 'EMPLOYEE';

const RANGES = [
  { days: 7, label: 'Next 7 days' },
  { days: 30, label: 'Next 30 days' },
  { days: 90, label: 'Next 3 months' },
  { days: 366, label: 'Full year' },
] as const;

/** Month heading for a `YYYY-MM-DD` date, e.g. "October 2026". */
function monthLabel(isoDate: string): string {
  return (
    parseIsoDate(isoDate)?.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) ??
    isoDate.slice(0, 7)
  );
}

/**
 * Every doctor / team birthday and anniversary in the coming year, soonest
 * first and grouped by month. One year-long fetch; filters run client-side.
 */
export function OccasionsPage() {
  const { canAny, role } = useAuth();
  const showDoctors = canAny(['doctors:own', 'doctors:manage']);
  // MRs only see their own doctors — colleagues are a manager / admin view.
  const showEmployees = role !== 'MR';

  const [type, setType] = useState<TypeFilter>('ALL');
  const [rangeDays, setRangeDays] = useState<number>(366);
  const [search, setSearch] = useState('');

  const query = useQuery({
    queryKey: ['occasions', 366],
    queryFn: () => dashboardApi.occasions({ days: 366 }),
  });

  const inRange = useMemo(
    () => (query.data?.items ?? []).filter((item) => item.daysAway <= rangeDays),
    [query.data, rangeDays],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return inRange.filter(
      (item) =>
        (type === 'ALL' || item.personType === type) &&
        (!needle ||
          item.name.toLowerCase().includes(needle) ||
          (item.subtitle ?? '').toLowerCase().includes(needle)),
    );
  }, [inRange, type, search]);

  const groups = useMemo(() => {
    const byMonth = new Map<string, Occasion[]>();
    for (const item of filtered) {
      const key = item.nextDate.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), item]);
    }
    return [...byMonth.entries()].map(([key, items]) => ({
      key,
      label: monthLabel(items[0]!.nextDate),
      items,
    }));
  }, [filtered]);

  const tabs: Array<TabItem<TypeFilter>> = [
    { value: 'ALL', label: 'All', count: inRange.length },
    ...(showDoctors
      ? [
          {
            value: 'DOCTOR' as const,
            label: 'Doctors',
            icon: Stethoscope,
            count: inRange.filter((item) => item.personType === 'DOCTOR').length,
          },
        ]
      : []),
    ...(showEmployees
      ? [
          {
            value: 'EMPLOYEE' as const,
            label: 'Team',
            icon: Users,
            count: inRange.filter((item) => item.personType === 'EMPLOYEE').length,
          },
        ]
      : []),
  ];

  const todayCount = inRange.filter((item) => item.daysAway === 0).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Birthdays & Anniversaries"
        description={
          todayCount > 0
            ? `${todayCount} occasion${todayCount > 1 ? 's' : ''} today. Doctors and team members — wish them on the day.`
            : 'Doctors and team members — wish them on the day. Add dates from the doctor or employee profile.'
        }
      />

      {query.isError ? <Alert message={getApiErrorMessage(query.error)} /> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Tabs items={tabs} value={type} onChange={setType} />
        <div className="grid gap-3 sm:grid-cols-2 lg:w-[28rem]">
          <Input
            label="Search"
            icon={Search}
            placeholder="Name, speciality, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            label="Range"
            value={rangeDays}
            onChange={(e) => setRangeDays(Number(e.target.value))}
          >
            {RANGES.map((range) => (
              <option key={range.days} value={range.days}>
                {range.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {query.isLoading ? (
        <Card className="p-8 text-center text-sm text-[var(--color-muted)]">Loading…</Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            title={inRange.length === 0 ? 'No occasions in this range' : 'Nothing matches'}
            description={
              inRange.length === 0
                ? 'Add a birthday or anniversary on a doctor or employee profile and it will show up here.'
                : 'Try a different search term or filter.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.key}>
              <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg)]/40 px-4 py-2.5">
                <h3 className="text-xs font-bold tracking-wider text-[var(--color-ink)] uppercase">
                  {group.label}
                </h3>
                <span className="text-[11px] font-semibold text-[var(--color-muted)]">
                  {group.items.length}
                </span>
              </div>
              <ul className="divide-y divide-[var(--color-border)]">
                {group.items.map((item) => (
                  <OccasionRow key={item.id} item={item} />
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
