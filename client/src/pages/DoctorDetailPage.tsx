import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { doctorsApi } from '@/services/doctors.service';

type TabKey = 'overview' | 'appointments' | 'visits' | 'medicines' | 'samples' | 'reports';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'visits', label: 'Visits' },
  { key: 'medicines', label: 'Medicines' },
  { key: 'samples', label: 'Sample History' },
  { key: 'reports', label: 'Reports' },
];

export function DoctorDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<TabKey>('overview');

  const detailsQuery = useQuery({
    queryKey: ['doctors', id, 'details'],
    queryFn: () => doctorsApi.getDetails(Number(id)),
    enabled: Boolean(id),
  });

  const data = detailsQuery.data;
  const profile = data?.profile;

  const kpiCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Assigned MR', value: profile?.assignedMrs.map((m) => m.fullName).join(', ') || '—' },
      { label: 'Total Appointments', value: data.stats.totalAppointments },
      { label: 'Total Visits', value: data.stats.totalVisits },
      { label: 'Medicines Discussed', value: data.stats.totalMedicinesDiscussed },
      { label: 'Samples Received', value: data.stats.totalSamplesReceived },
      { label: 'Last Visit', value: data.stats.lastVisitDate ?? '—' },
      { label: 'Next Follow-up', value: data.stats.nextFollowUp ?? '—' },
    ];
  }, [data, profile]);

  if (detailsQuery.isLoading) {
    return <Card className="p-8 text-sm text-[var(--color-muted)]">Loading doctor details…</Card>;
  }

  if (detailsQuery.isError || !data || !profile) {
    return (
      <Card className="space-y-3 p-8">
        <p className="font-medium text-[var(--color-danger)]">Doctor details could not be loaded.</p>
        <Link to="/doctors">
          <Button variant="secondary">Back to doctors</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={profile.fullName}
        description={[profile.specialization, profile.hospital || profile.clinic, profile.city]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Link to="/doctors">
            <Button variant="secondary">
              <ArrowLeft size={16} />
              Back
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <Card key={card.label} className="p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-muted)]">{card.label}</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-ink)]">{card.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-x-auto p-2">
        <div className="flex min-w-max gap-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-xl px-4 py-2 text-sm font-medium ${
                tab === item.key
                  ? 'bg-[var(--color-primary)] text-white'
                  : 'text-[var(--color-muted)] hover:bg-[var(--color-bg)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-3 p-5">
            <h3 className="font-semibold text-[var(--color-ink)]">Doctor Profile</h3>
            <dl className="space-y-2 text-sm">
              <Row label="Phone" value={profile.phone} />
              <Row label="Email" value={profile.email} />
              <Row label="City" value={profile.city} />
              <Row label="Visiting days" value={profile.visitingDays} />
              <Row label="Preferred time" value={profile.preferredTime} />
              <Row
                label="Assigned MR"
                value={profile.assignedMrs.map((m) => `${m.fullName} (${m.email})`).join(', ')}
              />
              <Row label="Status" value={profile.status} />
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-[var(--color-ink)]">History Timeline</h3>
            {data.timeline.length === 0 ? (
              <EmptyState title="No history yet" description="Appointments and visits will appear here." />
            ) : (
              <ul className="space-y-3">
                {data.timeline.slice(0, 20).map((event) => (
                  <li key={event.id} className="rounded-xl border border-[var(--color-border)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--color-ink)]">{event.title}</p>
                      <Badge
                        tone={
                          event.type === 'VISIT'
                            ? 'success'
                            : event.type === 'SAMPLE'
                              ? 'primary'
                              : 'neutral'
                        }
                      >
                        {event.type}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {new Date(event.at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-muted)]">{event.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}

      {tab === 'appointments' ? (
        <Card>
          <DataTable
            columns={['Date', 'Time', 'MR', 'Purpose', 'Status']}
            empty={
              data.appointments.length === 0 ? (
                <EmptyState title="No appointments" description="No appointments for this doctor." />
              ) : null
            }
          >
            {data.appointments.map((item) => (
              <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                <Td>{item.date}</Td>
                <Td>{item.time}</Td>
                <Td>{item.mr.fullName}</Td>
                <Td>{item.purpose ?? '—'}</Td>
                <Td>
                  <Badge
                    tone={
                      item.status === 'COMPLETED'
                        ? 'success'
                        : item.status === 'CANCELLED'
                          ? 'danger'
                          : 'primary'
                    }
                  >
                    {item.status}
                  </Badge>
                </Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}

      {tab === 'visits' ? (
        <Card>
          <DataTable
            columns={['Visit Date', 'Time', 'MR', 'Duration', 'Follow-up', 'Products', 'Samples']}
            empty={
              data.visits.length === 0 ? (
                <EmptyState title="No visits" description="No visits logged for this doctor." />
              ) : null
            }
          >
            {data.visits.map((item) => (
              <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                <Td>{item.visitDate}</Td>
                <Td>{item.visitTime ?? '—'}</Td>
                <Td>{item.mr.fullName}</Td>
                <Td>{item.meetingDurationMin ? `${item.meetingDurationMin} min` : '—'}</Td>
                <Td>{item.nextFollowUp ?? '—'}</Td>
                <Td>{item.products.map((p) => p.name).join(', ') || '—'}</Td>
                <Td>{item.samples.reduce((s, row) => s + row.quantity, 0)}</Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}

      {tab === 'medicines' ? (
        <Card>
          <DataTable
            columns={['Medicine', 'Company', 'Category', 'Times Discussed']}
            empty={
              data.medicines.length === 0 ? (
                <EmptyState title="No medicines discussed" description="Products appear after visits." />
              ) : null
            }
          >
            {data.medicines.map((item) => (
              <tr key={item.medicineId} className="border-b border-[var(--color-border)] last:border-0">
                <Td className="font-medium">{item.name}</Td>
                <Td>{item.company ?? '—'}</Td>
                <Td>{item.category ?? '—'}</Td>
                <Td>{item.timesDiscussed}</Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}

      {tab === 'samples' ? (
        <Card>
          <DataTable
            columns={['Date', 'Medicine', 'Qty', 'Batch', 'MR', 'Visit']}
            empty={
              data.samples.length === 0 ? (
                <EmptyState title="No samples" description="Sample history is empty for this doctor." />
              ) : null
            }
          >
            {data.samples.map((item) => (
              <tr key={item.id} className="border-b border-[var(--color-border)] last:border-0">
                <Td>{item.visitDate}</Td>
                <Td>{item.medicineName}</Td>
                <Td>{item.quantity}</Td>
                <Td>{item.batchNumber ?? '—'}</Td>
                <Td>{item.mr.fullName}</Td>
                <Td className="font-mono text-xs">#{item.visitId}</Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}

      {tab === 'reports' ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Card className="p-5">
            <p className="text-sm text-[var(--color-muted)]">Visits</p>
            <p className="mt-1 text-3xl font-semibold">{data.report.visitsCount}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-[var(--color-muted)]">Medicines discussed</p>
            <p className="mt-1 text-3xl font-semibold">{data.report.medicinesDiscussedCount}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm text-[var(--color-muted)]">Samples quantity</p>
            <p className="mt-1 text-3xl font-semibold">{data.report.samplesQuantity}</p>
          </Card>
          <Card className="p-5 sm:col-span-2 xl:col-span-3">
            <h3 className="mb-3 font-semibold">Appointments by status</h3>
            <div className="flex flex-wrap gap-3">
              {Object.entries(data.report.appointmentsByStatus).map(([status, count]) => (
                <Badge key={status} tone="primary">
                  {status}: {count}
                </Badge>
              ))}
              {Object.keys(data.report.appointmentsByStatus).length === 0 ? (
                <p className="text-sm text-[var(--color-muted)]">No appointment data</p>
              ) : null}
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="col-span-2 font-medium text-[var(--color-ink)]">{value || '—'}</dd>
    </div>
  );
}
