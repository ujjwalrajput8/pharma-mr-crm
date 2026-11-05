import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CalendarClock, ClipboardList, Plus, Search } from 'lucide-react';
import { AppointmentsPage } from '@/pages/AppointmentsPage';
import { LogVisitDialog, type LogVisitMode } from '@/components/visits/LogVisitDialog';
import { VisitDetailsDialog } from '@/components/visits/VisitDetailsDialog';
import { ReviewVisitDialog, SampleCorrectionDialog } from '@/components/visits/VisitActionDialogs';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ChoiceChips } from '@/components/ui/FormKit';
import { Badge, Card, EmbeddedPage, EmptyState, PageHeader } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useAuth } from '@/store/AuthContext';
import { appointmentsApi } from '@/services/appointments.service';
import { purposeLabel, visitsApi, type Visit, type VisitListParams } from '@/services/visits.service';
import { formatDisplayDate, toIsoDate } from '@/utils/datetime';

type MainTab = 'log' | 'appointments';
type View = 'all' | 'direct' | 'appointment' | 'unlisted';
type Range = 'today' | 'week' | 'month' | 'all';
const PAGE_SIZE = 20;

function rangeOf(range: Range): { from?: string; to?: string } {
  const now = new Date();
  const today = toIsoDate(now);
  if (range === 'today') return { from: today, to: today };
  if (range === 'week') {
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { from: toIsoDate(monday), to: today };
  }
  if (range === 'month') return { from: `${today.slice(0, 8)}01`, to: today };
  return {};
}

/** Visits & Appointments — one menu, two tabs (D9). Old /appointments links land on the second tab. */
export function VisitsPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab: MainTab = params.get('tab') === 'appointments' ? 'appointments' : 'log';
  const [logMode, setLogMode] = useState<LogVisitMode | null>(null);
  const canAppointments = can('appointments:own') || can('appointments:manage');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Visits & Appointments"
        description="Every doctor call — logged directly or from an appointment. Visits are corrected, never deleted."
        actions={
          tab === 'log' ? (
            <Button onClick={() => setLogMode({ kind: 'direct' })}>
              <Plus size={16} /> Log visit
            </Button>
          ) : undefined
        }
      />
      <Tabs
        variant="page"
        ariaLabel="Visits and appointments"
        value={tab}
        onChange={(next) => setParams(next === 'log' ? {} : { tab: next }, { replace: true })}
        items={[
          { value: 'log', label: 'Visit log', icon: ClipboardList },
          ...(canAppointments ? [{ value: 'appointments' as const, label: 'Appointments', icon: CalendarClock }] : []),
        ]}
      />
      {tab === 'appointments' ? (
        <EmbeddedPage>
          <AppointmentsPage />
        </EmbeddedPage>
      ) : (
        <VisitLog initialView={params.get('view') === 'unlisted' ? 'unlisted' : 'all'} onLog={setLogMode} />
      )}
      <LogVisitDialog mode={logMode} onClose={() => setLogMode(null)} />
    </div>
  );
}

function VisitLog({ initialView, onLog }: { initialView: View; onLog: (mode: LogVisitMode) => void }) {
  const { can, role } = useAuth();
  const manager = can('visits:manage');
  const [view, setView] = useState<View>(initialView);
  const [range, setRange] = useState<Range>('month');
  const [mrId, setMrId] = useState<number | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(null);
  const [samplesFor, setSamplesFor] = useState<Visit | null>(null);
  const [reviewFor, setReviewFor] = useState<Visit | null>(null);

  const query: VisitListParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(view === 'unlisted' ? {} : rangeOf(range)),
      ...(view === 'direct' ? { source: 'DIRECT' as const } : view === 'appointment' ? { source: 'APPOINTMENT' as const } : {}),
      ...(view === 'unlisted' ? { offList: true, ...(manager ? { reviewed: false } : {}) } : {}),
      ...(mrId ? { mrId } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }),
    [page, view, range, mrId, search, manager],
  );
  const visits = useQuery({ queryKey: ['visits', 'list', query], queryFn: () => visitsApi.list(query) });
  const mrs = useQuery({ queryKey: ['appointments', 'assignable-mrs'], queryFn: () => appointmentsApi.listAssignableMrs(), enabled: manager });
  const counts = visits.data?.meta.counts;
  const items = visits.data?.items ?? [];
  const reset = () => setPage(1);

  const actions = (v: Visit) => (
    <div className="flex flex-wrap items-center justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setOpenId(v.id)}>View</Button>
      {v.can.correct ? <Button variant="ghost" size="sm" onClick={() => onLog({ kind: 'correct', visit: v })}>Correct</Button> : null}
      {v.can.correctSamples && v.distributions.length > 0 ? <Button variant="ghost" size="sm" onClick={() => setSamplesFor(v)}>Samples</Button> : null}
      {v.can.review ? <Button variant="soft" size="sm" onClick={() => setReviewFor(v)}>Review</Button> : null}
    </div>
  );
  const badges = (v: Visit) => (
    <span className="flex flex-wrap gap-1">
      <Badge tone={v.source === 'DIRECT' ? 'primary' : 'neutral'} dot={false}>{v.source === 'DIRECT' ? 'Direct' : 'Appointment'}</Badge>
      {v.offList ? <Badge tone="warning" dot={false}>{v.review ? 'Unlisted · reviewed' : 'Unlisted'}</Badge> : null}
      {v.lastCorrectedAt ? <Badge tone="neutral" dot={false}>Corrected</Badge> : null}
    </span>
  );

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-[var(--color-border)] px-4 py-3">
        <Tabs
          ariaLabel="Visit views"
          value={view}
          onChange={(v) => { setView(v); reset(); }}
          items={[
            { value: 'all', label: 'All', count: counts?.all },
            { value: 'direct', label: 'Direct', count: counts?.direct },
            { value: 'appointment', label: 'From appointment', count: counts?.fromAppointment },
            { value: 'unlisted', label: manager ? 'Unlisted — review' : 'Unlisted', count: counts?.unlistedPending },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          {view !== 'unlisted' ? (
            <ChoiceChips
              size="sm"
              options={[
                { value: 'today', label: 'Today' },
                { value: 'week', label: 'This week' },
                { value: 'month', label: 'This month' },
                { value: 'all', label: 'All dates' },
              ]}
              value={range}
              onChange={(v) => { setRange((v || 'month') as Range); reset(); }}
            />
          ) : null}
          {manager ? (
            <select
              aria-label="Filter by MR"
              value={mrId}
              onChange={(e) => { setMrId(e.target.value ? Number(e.target.value) : ''); reset(); }}
              className="h-8 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/70 px-3 text-xs font-semibold text-[var(--color-ink)] outline-none focus:border-[var(--color-primary)]/70"
            >
              <option value="">All MRs</option>
              {(mrs.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>{m.fullName}</option>
              ))}
            </select>
          ) : null}
          <label className="ml-auto flex h-8 min-w-[200px] flex-1 items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-bg)]/70 px-3 sm:max-w-xs">
            <Search size={13} className="text-[var(--color-muted)]" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); reset(); }}
              placeholder="Doctor, MSL no., area or MR"
              className="w-full bg-transparent text-xs text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/60"
              aria-label="Search visits"
            />
          </label>
        </div>
      </div>

      {visits.isLoading ? (
        <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">Loading visits…</p>
      ) : items.length === 0 ? (
        <div className="p-6">
          <EmptyState
            title={view === 'unlisted' ? 'Nothing to review' : 'No visits here'}
            description={view === 'unlisted' ? 'Unlisted visits appear here until a manager reviews them.' : 'Log a visit from Today, a doctor, or the button above.'}
          />
        </div>
      ) : (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-[13px]" data-testid="visit-table">
              <thead className="border-b border-[var(--color-border)] text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                <tr>
                  <th className="px-4 py-2.5">Date</th>
                  <th className="px-4 py-2.5">Doctor</th>
                  {role !== 'MR' ? <th className="px-4 py-2.5">MR</th> : null}
                  <th className="px-4 py-2.5">Purpose</th>
                  <th className="px-4 py-2.5">Samples</th>
                  <th className="px-4 py-2.5">Type</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((v) => (
                  <tr key={v.id} data-testid="visit-row" className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-surface-subtle)]/60">
                    <td className="px-4 py-3 align-top">
                      <span className="font-semibold text-[var(--color-ink)]">{formatDisplayDate(v.visitDate)}</span>
                      <span className="block text-[11.5px] text-[var(--color-muted)]">{v.checkInTime ?? v.visitTime}</span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className="font-semibold text-[var(--color-ink)]">{v.doctor?.fullName ?? '—'}</span>
                      <span className="block text-[11.5px] text-[var(--color-muted)]">{[v.doctor?.mslNo ? `MSL ${v.doctor.mslNo}` : null, v.doctor?.area].filter(Boolean).join(' · ')}</span>
                      {v.doctor?.address ? <span className="block max-w-xs truncate text-[11px] text-[var(--color-muted)]/90">{v.doctor.address}</span> : null}
                    </td>
                    {role !== 'MR' ? (
                      <td className="px-4 py-3 align-top">
                        <span className="flex items-center gap-2">
                          {v.mr ? <Avatar name={v.mr.fullName} userId={v.mr.id} photoUrl={v.mr.photoUrl} size="sm" /> : null}
                          {v.mr?.fullName ?? '—'}
                        </span>
                      </td>
                    ) : null}
                    <td className="px-4 py-3 align-top">{purposeLabel(v.purpose)}</td>
                    <td className="px-4 py-3 align-top tabular-nums">{v.distributions.reduce((sum, s) => sum + s.quantity, 0) || '—'}</td>
                    <td className="px-4 py-3 align-top">{badges(v)}</td>
                    <td className="px-4 py-3 align-top">{actions(v)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-[var(--color-border)] md:hidden" data-testid="visit-cards">
            {items.map((v) => (
              <li key={v.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-[var(--color-ink)]">{v.doctor?.fullName ?? '—'}</p>
                    <p className="text-[11.5px] text-[var(--color-muted)]">
                      {formatDisplayDate(v.visitDate)} · {v.checkInTime ?? v.visitTime}
                      {role !== 'MR' && v.mr ? ` · ${v.mr.fullName}` : ''}
                    </p>
                  </div>
                  {badges(v)}
                </div>
                <p className="text-[12px] text-[var(--color-muted)]">
                  {purposeLabel(v.purpose)}
                  {v.distributions.length ? ` · ${v.distributions.reduce((sum, s) => sum + s.quantity, 0)} samples` : ''}
                </p>
                {actions(v)}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] px-4 py-2.5 text-xs text-[var(--color-muted)]">
            <span>{visits.data?.meta.total ?? 0} visits</span>
            <span className="flex items-center gap-2">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="tabular-nums">{page} / {visits.data?.meta.totalPages ?? 1}</span>
              <Button variant="ghost" size="sm" disabled={page >= (visits.data?.meta.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </span>
          </div>
        </>
      )}
      <VisitDetailsDialog
        visitId={openId}
        onClose={() => setOpenId(null)}
        onCorrect={(v) => { setOpenId(null); onLog({ kind: 'correct', visit: v }); }}
        onCorrectSamples={(v) => { setOpenId(null); setSamplesFor(v); }}
        onReview={(v) => { setOpenId(null); setReviewFor(v); }}
      />
      <SampleCorrectionDialog visit={samplesFor} onClose={() => setSamplesFor(null)} />
      <ReviewVisitDialog visit={reviewFor} onClose={() => setReviewFor(null)} />
    </Card>
  );
}

export default VisitsPage;
