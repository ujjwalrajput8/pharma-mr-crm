import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Phone, Pill, Search, Stethoscope, Warehouse } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Alert, Card, EmbeddedPage, EmptyState, PageHeader } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { DoctorsPage } from '@/pages/DoctorsPage';
import { storesApi, type MyStore, type StoreType } from '@/services/stores.service';
import { formatDisplayDate } from '@/utils/datetime';

type MslTab = 'doctors' | 'chemists' | 'stockists';
const TAB_TYPE: Record<Exclude<MslTab, 'doctors'>, StoreType> = { chemists: 'CHEMIST', stockists: 'STOCKIST' };

/**
 * MR "MSL List" (client menu → View): the doctors, chemists and stockists in the MR's
 * list. Doctors is the existing doctor screen; chemists / stockists are the ones an
 * Admin or Manager assigned to this MR.
 */
export function MslListPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: MslTab = requested === 'chemists' || requested === 'stockists' ? requested : 'doctors';
  const stores = useQuery({ queryKey: ['my-stores'], queryFn: () => storesApi.mine() });
  const count = (type: StoreType) => stores.data?.filter((s) => s.type === type).length;

  return (
    <div className="space-y-5">
      <PageHeader title="MSL List" description="Your doctors, chemists and stockists." />
      <Tabs
        variant="page"
        ariaLabel="MSL list"
        items={[
          { value: 'doctors', label: 'Doctors', icon: Stethoscope },
          { value: 'chemists', label: 'Chemists', icon: Pill, count: count('CHEMIST') },
          { value: 'stockists', label: 'Stockists', icon: Warehouse, count: count('STOCKIST') },
        ]}
        value={tab}
        onChange={(next) => setParams(next === 'doctors' ? {} : { tab: next })}
      />
      {tab === 'doctors' ? (
        <EmbeddedPage>
          <DoctorsPage />
        </EmbeddedPage>
      ) : (
        <StoreList
          type={TAB_TYPE[tab]}
          items={stores.data?.filter((s) => s.type === TAB_TYPE[tab]) ?? []}
          loading={stores.isLoading}
          error={stores.isError ? getApiErrorMessage(stores.error) : null}
        />
      )}
    </div>
  );
}

function StoreList({ type, items, loading, error }: { type: StoreType; items: MyStore[]; loading: boolean; error: string | null }) {
  const [search, setSearch] = useState('');
  const noun = type === 'STOCKIST' ? 'stockist' : 'chemist';
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => [s.name, s.ownerName, s.city, s.addressLine1, s.territory].some((v) => v?.toLowerCase().includes(q)));
  }, [items, search]);

  if (error) return <Alert message={error} />;
  return (
    <Card className="p-4">
      <label className="mb-3 flex h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
        <Search size={15} className="text-[var(--color-muted)]" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${noun}s by name, owner or area`}
          aria-label={`Search ${noun}s`}
          className="h-full w-full bg-transparent text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]/70"
        />
      </label>
      {loading ? <p className="py-6 text-center text-sm text-[var(--color-muted)]">Loading…</p> : null}
      {!loading && shown.length === 0 ? (
        <EmptyState
          title={items.length === 0 ? `No ${noun}s in your list yet` : `No ${noun} matches “${search}”`}
          description={items.length === 0 ? `Your Manager or Admin assigns ${noun}s to you.` : 'Try another name or area.'}
        />
      ) : null}
      <ul className="grid gap-3 md:grid-cols-2" data-testid={`msl-${noun}s`}>
        {shown.map((s) => (
          <li key={s.id} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" data-testid="msl-store">
            <p className="text-[14px] font-semibold text-[var(--color-ink)]">{s.name}</p>
            {s.ownerName ? <p className="text-xs text-[var(--color-muted)]">{s.ownerName}</p> : null}
            {s.addressLine1 || s.city || s.territory ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-[var(--color-muted)]">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                {[s.addressLine1, s.city, s.territory].filter(Boolean).join(', ')}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              {s.phone ? (
                <a href={`tel:${s.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-primary)]">
                  <Phone size={13} />
                  {s.phone}
                </a>
              ) : (
                <span className="text-[var(--color-muted)]">No phone</span>
              )}
              <span className="text-[var(--color-muted)]">In your list since {formatDisplayDate(s.since)}</span>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
