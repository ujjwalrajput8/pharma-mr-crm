import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { DataTable, Td } from '@/components/ui/DataTable';
import { Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { medicinesApi } from '@/services/medicines.service';

type TabKey = 'overview' | 'holdings' | 'mr' | 'doctor' | 'timeline';

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'holdings', label: 'MR Holdings' },
  { key: 'mr', label: 'MR-wise Usage' },
  { key: 'doctor', label: 'Doctor-wise Distribution' },
  { key: 'timeline', label: 'Distribution Timeline' },
];

export function MedicineDetailPage() {
  const { id = '' } = useParams();
  const [tab, setTab] = useState<TabKey>('overview');

  const detailsQuery = useQuery({
    queryKey: ['medicines', id, 'details'],
    queryFn: () => medicinesApi.getDetails(Number(id)),
    enabled: Boolean(id),
  });

  const data = detailsQuery.data;
  const profile = data?.profile;

  const kpiCards = useMemo(() => {
    if (!data) return [];
    return [
      { label: 'Current Stock', value: data.stats.currentStock },
      { label: 'Issued to MR', value: data.stats.issuedToMr ?? data.stats.issuedStock },
      { label: 'Company Remaining', value: data.stats.companyRemaining ?? data.stats.remainingStock },
      { label: 'Samples to Doctors', value: data.stats.samplesIssued },
      { label: 'Opening Stock', value: data.stats.openingStock },
      { label: 'MR Recipients', value: data.stats.mrRecipients },
    ];
  }, [data]);

  if (detailsQuery.isLoading) {
    return <Card className="p-8 text-sm text-[var(--color-muted)]">Loading medicine details…</Card>;
  }

  if (detailsQuery.isError || !data || !profile) {
    return (
      <Card className="space-y-3 p-8">
        <p className="font-medium text-[var(--color-danger)]">Medicine details could not be loaded.</p>
        <Link to="/medicines">
          <Button variant="secondary">Back to medicines</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title={profile.name}
        description={[profile.brandName, profile.genericName, profile.company, profile.strength]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Link to="/medicines">
            <Button variant="secondary">
              <ArrowLeft size={16} />
              Back
            </Button>
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
        <Card className="p-5">
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-[var(--color-muted)]">Composition</dt>
              <dd className="font-medium">{profile.composition || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-muted)]">Category</dt>
              <dd className="font-medium">{profile.category || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-muted)]">Batch Number</dt>
              <dd className="font-medium">{profile.batchNumber || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-muted)]">Expiry</dt>
              <dd className="font-medium">{profile.expiryDate || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-muted)]">Available Samples</dt>
              <dd className="font-medium">{profile.sampleAvailable ? 'Yes' : 'No'}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--color-muted)]">MRP</dt>
              <dd className="font-medium">₹{profile.mrp.toFixed(2)}</dd>
            </div>
          </dl>
          <p className="mt-4 text-sm text-[var(--color-muted)]">
            Which MRs received this medicine: {data.mrWise.map((m) => m.fullName).join(', ') || 'None yet'}
          </p>
        </Card>
      ) : null}

      {tab === 'holdings' ? (
        <Card>
          <DataTable
            columns={['MR', 'Email', 'Qty with MR', 'Batch']}
            empty={
              !data.mrHoldings?.length ? (
                <EmptyState title="No MR holdings" description="Issue medicine to MRs first." />
              ) : null
            }
          >
            {(data.mrHoldings ?? []).map((row) => (
              <tr key={row.mrId} className="border-b border-[var(--color-border)] last:border-0">
                <Td className="font-medium">{row.fullName}</Td>
                <Td>{row.email}</Td>
                <Td>{row.quantity}</Td>
                <Td>{row.batchNumber || '—'}</Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}

      {tab === 'mr' ? (
        <Card>
          <DataTable
            columns={['MR', 'Email', 'Quantity', 'Issues']}
            empty={
              data.mrWise.length === 0 ? (
                <EmptyState title="No MR distribution" description="No samples issued yet." />
              ) : null
            }
          >
            {data.mrWise.map((row) => (
              <tr key={row.mrId} className="border-b border-[var(--color-border)] last:border-0">
                <Td className="font-medium">{row.fullName}</Td>
                <Td>{row.email ?? '—'}</Td>
                <Td>{row.quantity}</Td>
                <Td>{row.issues}</Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}

      {tab === 'doctor' ? (
        <Card>
          <DataTable
            columns={['Doctor', 'Quantity', 'Issues']}
            empty={
              data.doctorWise.length === 0 ? (
                <EmptyState title="No doctor distribution" description="No samples issued yet." />
              ) : null
            }
          >
            {data.doctorWise.map((row) => (
              <tr key={row.doctorId} className="border-b border-[var(--color-border)] last:border-0">
                <Td className="font-medium">{row.fullName}</Td>
                <Td>{row.quantity}</Td>
                <Td>{row.issues}</Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}

      {tab === 'timeline' ? (
        <Card>
          <DataTable
            columns={['Date', 'MR', 'Doctor', 'Qty', 'Batch', 'Visit Date']}
            empty={
              data.timeline.length === 0 ? (
                <EmptyState title="No timeline" description="Distribution events will appear here." />
              ) : null
            }
          >
            {data.timeline.map((row) => (
              <tr key={row.id} className="border-b border-[var(--color-border)] last:border-0">
                <Td>{row.date}</Td>
                <Td>{row.mrName}</Td>
                <Td>{row.doctorName}</Td>
                <Td>{row.quantity}</Td>
                <Td>{row.batchNumber || '—'}</Td>
                <Td>{row.visitDate}</Td>
              </tr>
            ))}
          </DataTable>
        </Card>
      ) : null}
    </div>
  );
}
