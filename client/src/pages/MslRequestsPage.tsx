import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, ListPlus, ListX, Pill, Stethoscope, TriangleAlert, Warehouse, XCircle } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { ChoiceChips, FormFull, FormGrid } from '@/components/ui/FormKit';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, Card, EmptyState, PageHeader } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import { doctorsApi } from '@/services/doctors.service';
import { MSL_PARTY_LABEL, mslApi, type MslParty, type MslRequest, type MslStatus } from '@/services/msl.service';
import { storesApi } from '@/services/stores.service';
import { useAuth } from '@/store/AuthContext';
import { formatDisplayDate } from '@/utils/datetime';

const STATUS_TONE: Record<MslStatus, 'warning' | 'success' | 'danger' | 'neutral'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELLED: 'neutral',
};
const STATUS_LABEL: Record<MslStatus, string> = { PENDING: 'Waiting', APPROVED: 'Approved', REJECTED: 'Rejected', CANCELLED: 'Cancelled' };
const PARTY_ICON = { DOCTOR: Stethoscope, CHEMIST: Pill, STOCKIST: Warehouse } as const;

/** MSL Management (client note): MRs ask to add / remove; Managers and Admin decide. */
export function MslRequestsPage() {
  const { can } = useAuth();
  return can('msl-requests:manage') ? <DecideView /> : <MyRequestsView />;
}

// ── MR ───────────────────────────────────────────────────────────────────

function MyRequestsView() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('party');
  const party: MslParty = requested === 'CHEMIST' || requested === 'STOCKIST' ? requested : 'DOCTOR';
  const noun = MSL_PARTY_LABEL[party].toLowerCase();
  const [dialog, setDialog] = useState<'ADD' | 'REMOVE' | null>(null);
  const requests = useQuery({ queryKey: ['msl-requests', 'mine'], queryFn: () => mslApi.list({ scope: 'mine' }) });
  const mine = (requests.data?.items ?? []).filter((r) => r.party === party);
  const pending = (p: MslParty) => (requests.data?.items ?? []).filter((r) => r.party === p && r.status === 'PENDING').length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="MSL Management"
        description="Ask your manager to add a doctor, chemist or stockist to your list, or to take one off."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setDialog('ADD')}>
              <ListPlus size={16} /> Request to add {noun}
            </Button>
            <Button variant="secondary" onClick={() => setDialog('REMOVE')}>
              <ListX size={16} /> Request to remove
            </Button>
          </div>
        }
      />
      <Tabs
        variant="page"
        ariaLabel="MSL party"
        items={(['DOCTOR', 'CHEMIST', 'STOCKIST'] as const).map((p) => ({ value: p, label: MSL_PARTY_LABEL[p], icon: PARTY_ICON[p], count: pending(p) || undefined }))}
        value={party}
        onChange={(next) => setParams(next === 'DOCTOR' ? {} : { party: next })}
      />
      {requests.isError ? <Alert message={getApiErrorMessage(requests.error)} /> : null}
      <Card>
        {requests.isLoading ? <p className="px-4 py-8 text-center text-sm text-[var(--color-muted)]">Loading…</p> : null}
        {!requests.isLoading && mine.length === 0 ? (
          <div className="p-6">
            <EmptyState title={`No ${noun} requests yet`} description={`Use "Request to add ${noun}" or "Request to remove" above.`} />
          </div>
        ) : null}
        <ul className="divide-y divide-[var(--color-border)]" data-testid="my-msl-requests">
          {mine.map((r) => (
            <RequestRow key={r.id} request={r} />
          ))}
        </ul>
      </Card>
      {dialog === 'ADD' ? <AddRequestDialog party={party} onClose={() => setDialog(null)} /> : null}
      {dialog === 'REMOVE' ? <RemoveRequestDialog party={party} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

function RequestRow({ request: r }: { request: MslRequest }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const cancel = useMutation({
    mutationFn: () => mslApi.cancel(r.id),
    onSuccess: async () => {
      toast.success('Request cancelled');
      await queryClient.invalidateQueries({ queryKey: ['msl-requests'] });
    },
    onError: (err) => toast.error('Could not cancel', getApiErrorMessage(err)),
  });
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3" data-testid="msl-request">
      <div className="min-w-0">
        <p className="text-[14px] font-semibold text-[var(--color-ink)]">{r.subject}</p>
        <p className="text-xs text-[var(--color-muted)]">
          Sent {formatDisplayDate(r.createdAt.slice(0, 10))}
          {r.reason ? ` · ${r.reason}` : ''}
        </p>
        {r.decidedBy && r.status !== 'CANCELLED' ? (
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {STATUS_LABEL[r.status]} by {r.decidedBy.fullName}
            {r.decisionNote ? ` — “${r.decisionNote}”` : ''}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
        {r.status === 'PENDING' ? (
          <Button variant="ghost" size="sm" onClick={() => cancel.mutate()} loading={cancel.isPending}>
            Cancel
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function AddRequestDialog({ party, onClose }: { party: MslParty; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const noun = MSL_PARTY_LABEL[party].toLowerCase();
  const [f, setF] = useState<Record<string, string>>({});
  const set = (key: string) => (e: { target: { value: string } }) => setF((prev) => ({ ...prev, [key]: e.target.value }));
  const name = party === 'DOCTOR' ? f.fullName : f.name;
  const send = useMutation({
    mutationFn: () => {
      const clean = Object.fromEntries(Object.entries(f).filter(([k, v]) => k !== 'reason' && v.trim() !== '').map(([k, v]) => [k, v.trim()]));
      return mslApi.create({ action: 'ADD', party, details: clean, reason: f.reason?.trim() || undefined });
    },
    onSuccess: async () => {
      toast.success('Request sent to your manager');
      await queryClient.invalidateQueries({ queryKey: ['msl-requests'] });
      onClose();
    },
  });
  return (
    <Modal
      open
      title={`Request to add a ${noun}`}
      description="Your manager approves it, then it appears in your MSL list."
      icon={ListPlus}
      onClose={onClose}
      className="max-w-2xl"
      error={send.isError ? getApiErrorMessage(send.error) : null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button onClick={() => send.mutate()} disabled={!name || name.trim().length < 2} loading={send.isPending}>
            Send request
          </Button>
        </>
      }
    >
      <FormGrid>
        {party === 'DOCTOR' ? (
          <>
            <Input label="Doctor's Name" required maxLength={150} value={f.fullName ?? ''} onChange={set('fullName')} placeholder="Dr. Rajesh Sharma" />
            <Input label="Speciality" maxLength={120} value={f.specialization ?? ''} onChange={set('specialization')} placeholder="e.g. Physician" />
            <ChoiceChips
              label="MSL Class"
              options={['A', 'B', 'C'].map((c) => ({ value: c, label: `Class ${c}` }))}
              value={f.mslClass ?? ''}
              allowClear
              onChange={(v) => setF((prev) => ({ ...prev, mslClass: v }))}
            />
            <Input label="Mobile No" inputMode="tel" value={f.phone ?? ''} onChange={set('phone')} />
            <Input label="Area" maxLength={120} value={f.area ?? ''} onChange={set('area')} />
            <FormFull>
              <Textarea label="Address" rows={2} maxLength={500} value={f.address ?? ''} onChange={set('address')} />
            </FormFull>
          </>
        ) : (
          <>
            <Input label={`${MSL_PARTY_LABEL[party]} name`} required maxLength={150} value={f.name ?? ''} onChange={set('name')} />
            <Input label="Owner" maxLength={120} value={f.ownerName ?? ''} onChange={set('ownerName')} />
            <Input label="Phone" inputMode="tel" value={f.phone ?? ''} onChange={set('phone')} />
            <Input label="City" maxLength={100} value={f.city ?? ''} onChange={set('city')} />
            <FormFull>
              <Input label="Address" maxLength={200} value={f.addressLine1 ?? ''} onChange={set('addressLine1')} />
            </FormFull>
          </>
        )}
        <FormFull>
          <Textarea label="Why add" optional rows={2} maxLength={500} value={f.reason ?? ''} onChange={set('reason')} placeholder="e.g. New clinic in my area, sees 40 patients a day" />
        </FormFull>
      </FormGrid>
    </Modal>
  );
}

function RemoveRequestDialog({ party, onClose }: { party: MslParty; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const noun = MSL_PARTY_LABEL[party].toLowerCase();
  const [id, setId] = useState('');
  const [reason, setReason] = useState('');
  const doctors = useQuery({ queryKey: ['doctors', 'mine'], queryFn: () => doctorsApi.list(), enabled: party === 'DOCTOR' });
  const stores = useQuery({ queryKey: ['my-stores'], queryFn: () => storesApi.mine(), enabled: party !== 'DOCTOR' });
  const options = useMemo(
    () =>
      party === 'DOCTOR'
        ? (doctors.data ?? []).map((d) => ({ value: String(d.id), label: `${d.fullName}${d.area ? ` · ${d.area}` : ''}` }))
        : (stores.data ?? []).filter((s) => s.type === party).map((s) => ({ value: String(s.id), label: `${s.name}${s.city ? ` · ${s.city}` : ''}` })),
    [party, doctors.data, stores.data],
  );
  const send = useMutation({
    mutationFn: () => mslApi.create({ action: 'REMOVE', party, ...(party === 'DOCTOR' ? { doctorId: Number(id) } : { storeId: Number(id) }), reason: reason.trim() }),
    onSuccess: async () => {
      toast.success('Request sent to your manager');
      await queryClient.invalidateQueries({ queryKey: ['msl-requests'] });
      onClose();
    },
  });
  return (
    <Modal
      open
      title={`Request to remove a ${noun}`}
      description="Your manager approves it, then it leaves your list. Past visits stay."
      icon={ListX}
      onClose={onClose}
      className="max-w-xl"
      error={send.isError ? getApiErrorMessage(send.error) : null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button onClick={() => send.mutate()} disabled={!id || reason.trim().length < 3} loading={send.isPending}>
            Send request
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label={MSL_PARTY_LABEL[party]} required value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose from your list…</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Textarea label="Why remove" required rows={2} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Clinic closed / moved out of my area" />
      </div>
    </Modal>
  );
}

// ── Manager / Admin ──────────────────────────────────────────────────────

function DecideView() {
  const [tab, setTab] = useState<'pending' | 'decided'>('pending');
  const [deciding, setDeciding] = useState<{ request: MslRequest; action: 'APPROVE' | 'REJECT' } | null>(null);
  const requests = useQuery({ queryKey: ['msl-requests', 'team'], queryFn: () => mslApi.list({ scope: 'team' }) });
  const items = (requests.data?.items ?? []).filter((r) => (tab === 'pending' ? r.status === 'PENDING' : r.status !== 'PENDING'));

  return (
    <div className="space-y-5">
      <PageHeader title="MSL Requests" description="Your MRs ask to add or remove doctors, chemists and stockists. Approve to change their list." />
      <Tabs
        ariaLabel="MSL request status"
        items={[
          { value: 'pending', label: 'Waiting', count: requests.data?.pending },
          { value: 'decided', label: 'Decided' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {requests.isError ? <Alert message={getApiErrorMessage(requests.error)} /> : null}
      <Card>
        {!requests.isLoading && items.length === 0 ? (
          <div className="p-6">
            <EmptyState title={tab === 'pending' ? 'Nothing waiting' : 'No decided requests yet'} description="Requests from your MRs appear here." />
          </div>
        ) : null}
        <ul className="divide-y divide-[var(--color-border)]" data-testid="team-msl-requests">
          {items.map((r) => {
            const Icon = PARTY_ICON[r.party];
            const d = r.details ?? {};
            const facts = [d.specialization, d.mslClass ? `Class ${d.mslClass}` : null, d.ownerName, d.phone, d.area ?? d.city, d.address ?? d.addressLine1].filter(Boolean);
            return (
              <li key={r.id} className="space-y-2 px-4 py-3" data-testid="team-msl-request">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--color-ink)]">{r.subject}</p>
                      <p className="text-xs text-[var(--color-muted)]">
                        {r.mr.fullName} · {MSL_PARTY_LABEL[r.party]} · sent {formatDisplayDate(r.createdAt.slice(0, 10))}
                      </p>
                      {facts.length ? <p className="text-xs text-[var(--color-muted)]">{facts.join(' · ')}</p> : null}
                      {r.reason ? <p className="mt-1 text-[13px] text-[var(--color-ink)]">“{r.reason}”</p> : null}
                    </div>
                  </div>
                  {r.status === 'PENDING' ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => setDeciding({ request: r, action: 'APPROVE' })}>
                        <CheckCircle2 size={14} /> Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setDeciding({ request: r, action: 'REJECT' })}>
                        <XCircle size={14} /> Reject
                      </Button>
                    </div>
                  ) : (
                    <div className="text-right">
                      <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                      {r.decidedBy ? <p className="mt-1 text-[11px] text-[var(--color-muted)]">by {r.decidedBy.fullName}</p> : null}
                    </div>
                  )}
                </div>
                {r.similar?.length ? (
                  <p className="flex items-start gap-1.5 rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-xs text-[var(--color-warning)]" data-testid="msl-similar">
                    <TriangleAlert size={13} className="mt-0.5 shrink-0" />
                    Looks like an existing record: {r.similar.map((s) => `${s.name}${s.info ? ` (${s.info})` : ''}`).join(', ')}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>
      {deciding ? <DecideDialog {...deciding} onClose={() => setDeciding(null)} /> : null}
    </div>
  );
}

function DecideDialog({ request, action, onClose }: { request: MslRequest; action: 'APPROVE' | 'REJECT'; onClose: () => void }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [note, setNote] = useState('');
  const approve = action === 'APPROVE';
  const decide = useMutation({
    mutationFn: () => mslApi.decide(request.id, { action, note: note.trim() || undefined }),
    onSuccess: async () => {
      toast.success(approve ? 'Request approved' : 'Request rejected');
      await Promise.all(['msl-requests', 'doctors', 'stores'].map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
      onClose();
    },
  });
  return (
    <Modal
      open
      title={`${approve ? 'Approve' : 'Reject'}: ${request.subject}`}
      description={`${request.mr.fullName}'s request. ${approve ? (request.action === 'ADD' ? 'It is created and added to their list.' : 'It leaves their list; past visits stay.') : 'Nothing changes; they see your reason.'}`}
      icon={approve ? CheckCircle2 : XCircle}
      onClose={onClose}
      className="max-w-lg"
      error={decide.isError ? getApiErrorMessage(decide.error) : null}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={decide.isPending}>
            Cancel
          </Button>
          <Button variant={approve ? 'primary' : 'danger'} onClick={() => decide.mutate()} disabled={!approve && note.trim().length < 3} loading={decide.isPending}>
            {approve ? 'Approve' : 'Reject'}
          </Button>
        </>
      }
    >
      <Textarea
        label={approve ? 'Note' : 'Reason'}
        optional={approve}
        required={!approve}
        rows={2}
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={approve ? 'Optional' : 'e.g. Already in Neha’s list'}
      />
    </Modal>
  );
}
