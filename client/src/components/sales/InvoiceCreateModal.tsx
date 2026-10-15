import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Receipt, Stethoscope, Store, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ChoiceCards } from '@/components/ui/ChoiceCards';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Textarea } from '@/components/ui/Field';
import { FormSection, Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Page';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { doctorsApi } from '@/services/doctors.service';
import { employeesApi } from '@/services/employees.service';
import { invoicesApi, type CreateInvoicePayload } from '@/services/invoices.service';
import { medicinesApi } from '@/services/medicines.service';
import { storesApi } from '@/services/stores.service';
import { formatINR } from '@/utils/currency';
import { toIsoDate } from '@/utils/datetime';

interface LineDraft {
  key: number;
  medicineId: string;
  quantity: string;
  rate: string;
  discountPct: string;
}

function emptyLine(key: number): LineDraft {
  return { key, medicineId: '', quantity: '1', rate: '', discountPct: '' };
}

function lineAmount(line: LineDraft): number {
  const qty = Number(line.quantity) || 0;
  const rate = Number(line.rate) || 0;
  const disc = Number(line.discountPct) || 0;
  return qty * rate * (1 - disc / 100);
}

export function InvoiceCreateModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (invoiceId: number) => void;
}) {
  const { can, user } = useAuth();
  const canManageSales = can('sales:manage');
  const toast = useToast();
  const queryClient = useQueryClient();

  const [partyType, setPartyType] = useState<'DOCTOR' | 'STORE'>('DOCTOR');
  const [partyId, setPartyId] = useState('');
  const [mrId, setMrId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(toIsoDate(new Date()));
  const [dueDate, setDueDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(1)]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPartyType('DOCTOR');
    setPartyId('');
    setMrId(user ? String(user.id) : '');
    setInvoiceDate(toIsoDate(new Date()));
    setDueDate('');
    setRemarks('');
    setLines([emptyLine(1)]);
    setError(null);
  }, [open, user]);

  const doctorsQuery = useQuery({
    queryKey: ['doctors'],
    queryFn: () => doctorsApi.list(),
    enabled: open,
  });
  const storesQuery = useQuery({
    queryKey: ['stores'],
    queryFn: () => storesApi.list(),
    enabled: open,
  });
  const medicinesQuery = useQuery({
    queryKey: ['medicines'],
    queryFn: () => medicinesApi.list(),
    enabled: open,
  });
  const employeesQuery = useQuery({
    queryKey: ['employees', 'options'],
    queryFn: () => employeesApi.list(),
    enabled: open && canManageSales,
  });

  const partyOptions = useMemo(() => {
    if (partyType === 'DOCTOR') {
      return (doctorsQuery.data ?? []).map((doctor) => ({
        value: String(doctor.id),
        label: doctor.fullName,
        meta: [doctor.specialization, doctor.city].filter(Boolean).join(' · ') || undefined,
      }));
    }
    return (storesQuery.data ?? []).map((store) => ({
      value: String(store.id),
      label: store.name,
      meta: [store.ownerName, store.city].filter(Boolean).join(' · ') || undefined,
    }));
  }, [partyType, doctorsQuery.data, storesQuery.data]);

  const mrOptions = useMemo(
    () =>
      (employeesQuery.data ?? [])
        .filter((employee) => employee.role !== 'ADMIN')
        .map((employee) => ({
          value: String(employee.id),
          label: employee.fullName,
          meta: [employee.employeeCode, employee.role].filter(Boolean).join(' · ') || undefined,
        })),
    [employeesQuery.data],
  );

  const medicineOptions = useMemo(
    () =>
      (medicinesQuery.data ?? []).map((medicine) => ({
        value: String(medicine.id),
        label: medicine.name,
        meta: [medicine.company, `MRP ${formatINR(medicine.mrp)}`].filter(Boolean).join(' · '),
      })),
    [medicinesQuery.data],
  );

  const totals = useMemo(() => {
    const subtotal = lines.reduce(
      (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.rate) || 0),
      0,
    );
    const total = lines.reduce((sum, line) => sum + lineAmount(line), 0);
    return { subtotal, discount: subtotal - total, total };
  }, [lines]);

  function patchLine(key: number, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function pickMedicine(key: number, medicineId: string) {
    const medicine = (medicinesQuery.data ?? []).find((m) => String(m.id) === medicineId);
    patchLine(key, {
      medicineId,
      // MRP is the default rate; the field stays editable for negotiated prices.
      rate: medicine ? String(medicine.mrp) : '',
    });
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateInvoicePayload) => invoicesApi.create(payload),
    onSuccess: async (invoice) => {
      toast.success('Invoice created', `${invoice.invoiceNo} · ${formatINR(invoice.totalAmount)}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['invoices'] }),
        queryClient.invalidateQueries({ queryKey: ['invoice-summary'] }),
        queryClient.invalidateQueries({ queryKey: ['sales'] }),
        queryClient.invalidateQueries({ queryKey: ['targets'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onClose();
      onCreated?.(invoice.id);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!partyId) {
      setError(partyType === 'DOCTOR' ? 'Select the doctor to bill' : 'Select the chemist to bill');
      return;
    }
    for (const line of lines) {
      if (!line.medicineId) {
        setError('Every line needs a medicine');
        return;
      }
      if (!(Number(line.quantity) > 0)) {
        setError('Quantity must be at least 1');
        return;
      }
      if (Number(line.rate) < 0 || line.rate === '') {
        setError('Rate cannot be empty or negative');
        return;
      }
      const disc = Number(line.discountPct || 0);
      if (disc < 0 || disc > 100) {
        setError('Discount must be between 0 and 100%');
        return;
      }
    }
    createMutation.mutate({
      ...(partyType === 'DOCTOR'
        ? { doctorId: Number(partyId) }
        : { medicalStoreId: Number(partyId) }),
      ...(canManageSales && mrId ? { mrId: Number(mrId) } : {}),
      invoiceDate,
      ...(dueDate ? { dueDate } : {}),
      ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      lines: lines.map((line) => ({
        medicineId: Number(line.medicineId),
        quantity: Number(line.quantity),
        rate: Number(line.rate),
        ...(Number(line.discountPct || 0) > 0 ? { discountPct: Number(line.discountPct) } : {}),
      })),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New Invoice"
      description="Bill medicines to a doctor or chemist — lines also post into sales."
      icon={Receipt}
      className="max-w-3xl"
      footer={
        <>
          <span className="mr-auto text-sm font-bold text-[var(--color-ink)] tabular-nums">
            Total: {formatINR(totals.total)}
          </span>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="invoice-form" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Saving…' : 'Save Invoice'}
          </Button>
        </>
      }
    >
      <form id="invoice-form" className="space-y-5" onSubmit={onSubmit}>
        {error ? <Alert message={error} /> : null}

        <FormSection title="Bill to">
          <div className="space-y-3">
            <ChoiceCards
              value={partyType}
              onChange={(value) => {
                setPartyType(value);
                setPartyId('');
              }}
              choices={[
                {
                  value: 'DOCTOR',
                  label: 'Doctor',
                  description: 'Prescriber billing (doctor-wise record)',
                  icon: Stethoscope,
                },
                {
                  value: 'STORE',
                  label: 'Chemist',
                  description: 'Medical store / stockist billing',
                  icon: Store,
                },
              ]}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SearchableSelect
                label={partyType === 'DOCTOR' ? 'Doctor' : 'Medical store'}
                required
                value={partyId}
                onChange={setPartyId}
                options={partyOptions}
                placeholder={partyType === 'DOCTOR' ? 'Select doctor…' : 'Select store…'}
              />
              {canManageSales ? (
                <SearchableSelect
                  label="Booked by (MR)"
                  required
                  value={mrId}
                  onChange={setMrId}
                  options={mrOptions}
                  placeholder="Select MR…"
                />
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DatePicker label="Invoice date" required value={invoiceDate} onChange={setInvoiceDate} />
              <DatePicker label="Due date" value={dueDate} onChange={setDueDate} />
            </div>
          </div>
        </FormSection>

        <FormSection title="Lines" subtitle="Rate pre-fills from MRP and stays editable">
          <div className="space-y-2.5">
            {lines.map((line, index) => (
              <div
                key={line.key}
                className="grid items-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 p-3 sm:grid-cols-[minmax(0,2.2fr)_repeat(3,minmax(0,0.8fr))_auto]"
              >
                <SearchableSelect
                  label={`Medicine ${index + 1}`}
                  required
                  value={line.medicineId}
                  onChange={(value) => pickMedicine(line.key, value)}
                  options={medicineOptions}
                  placeholder="Select medicine…"
                />
                <Input
                  label="Qty"
                  type="number"
                  min={1}
                  required
                  value={line.quantity}
                  onChange={(e) => patchLine(line.key, { quantity: e.target.value })}
                />
                <Input
                  label="Rate ₹"
                  type="number"
                  min={0}
                  step="0.01"
                  required
                  value={line.rate}
                  onChange={(e) => patchLine(line.key, { rate: e.target.value })}
                />
                <Input
                  label="Disc %"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={line.discountPct}
                  onChange={(e) => patchLine(line.key, { discountPct: e.target.value })}
                />
                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-end">
                  <p className="text-sm font-bold text-[var(--color-ink)] tabular-nums">
                    {formatINR(lineAmount(line))}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() =>
                      setLines((prev) => prev.filter((item) => item.key !== line.key))
                    }
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3">
              <Button
                variant="soft"
                size="sm"
                onClick={() =>
                  setLines((prev) => [
                    ...prev,
                    emptyLine(Math.max(0, ...prev.map((item) => item.key)) + 1),
                  ])
                }
              >
                <Plus size={14} /> Add line
              </Button>
              <div className="text-right text-xs text-[var(--color-muted)]">
                <p>
                  Subtotal: <span className="font-semibold tabular-nums">{formatINR(totals.subtotal)}</span>
                  {' · '}Discount:{' '}
                  <span className="font-semibold tabular-nums">{formatINR(totals.discount)}</span>
                </p>
                <p className="mt-0.5 text-sm font-bold text-[var(--color-ink)] tabular-nums">
                  Total: {formatINR(totals.total)}
                </p>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection title="Notes">
          <Textarea
            label="Remarks"
            optional
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Payment terms, delivery notes…"
          />
        </FormSection>
      </form>
    </Modal>
  );
}
