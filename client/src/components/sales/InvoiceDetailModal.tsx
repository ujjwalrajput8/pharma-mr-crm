import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CreditCard, Receipt, Trash2 } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select } from '@/components/ui/Field';
import { FormSection, Modal } from '@/components/ui/Modal';
import { Alert, DetailRow } from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import {
  invoicesApi,
  PAYMENT_MODES,
  type PaymentMode,
  type RecordPaymentPayload,
} from '@/services/invoices.service';
import { InvoiceStatusBadge, PartyLabel } from '@/components/sales/InvoiceStatusBadge';
import { formatINR } from '@/utils/currency';
import { toIsoDate } from '@/utils/datetime';

export function InvoiceDetailModal({
  invoiceId,
  onClose,
}: {
  invoiceId: number | null;
  onClose: () => void;
}) {
  const { can } = useAuth();
  const canManageSales = can('sales:manage');
  const toast = useToast();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<number | null>(null);

  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(toIsoDate(new Date()));
  const [payMode, setPayMode] = useState<PaymentMode>('CASH');
  const [payReference, setPayReference] = useState('');

  const detailQuery = useQuery({
    queryKey: ['invoices', invoiceId],
    queryFn: () => invoicesApi.get(invoiceId as number),
    enabled: invoiceId !== null,
  });
  const invoice = detailQuery.data;

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['invoices'] }),
      queryClient.invalidateQueries({ queryKey: ['invoice-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['sales'] }),
      queryClient.invalidateQueries({ queryKey: ['targets'] }),
    ]);
  }

  const paymentMutation = useMutation({
    mutationFn: (payload: RecordPaymentPayload) =>
      invoicesApi.addPayment(invoiceId as number, payload),
    onSuccess: async () => {
      toast.success('Payment recorded');
      setPayAmount('');
      setPayReference('');
      setError(null);
      await refresh();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: number) => invoicesApi.removePayment(invoiceId as number, paymentId),
    onSuccess: async () => {
      toast.success('Payment removed');
      setPaymentToDelete(null);
      setError(null);
      await refresh();
    },
    onError: (err) => {
      setPaymentToDelete(null);
      setError(getApiErrorMessage(err));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => invoicesApi.cancel(invoiceId as number),
    onSuccess: async () => {
      toast.success('Invoice cancelled');
      setConfirmCancel(false);
      setError(null);
      await refresh();
    },
    onError: (err) => {
      setConfirmCancel(false);
      setError(getApiErrorMessage(err));
    },
  });

  function onSubmitPayment(event: FormEvent) {
    event.preventDefault();
    if (!invoice) return;
    const amount = Number(payAmount);
    if (!(amount > 0)) {
      setError('Enter a payment amount greater than zero');
      return;
    }
    if (amount > invoice.outstanding + 0.005) {
      setError(`Payment exceeds the outstanding ${formatINR(invoice.outstanding)}`);
      return;
    }
    paymentMutation.mutate({
      amount,
      paymentDate: payDate,
      mode: payMode,
      ...(payReference.trim() ? { reference: payReference.trim() } : {}),
    });
  }

  const canRecordPayment =
    invoice && invoice.status !== 'CANCELLED' && invoice.outstanding > 0.005;
  const canCancel =
    invoice && canManageSales && invoice.status !== 'CANCELLED' && invoice.paidAmount <= 0.005;

  return (
    <Modal
      open={invoiceId !== null}
      onClose={onClose}
      title={invoice ? invoice.invoiceNo : 'Invoice'}
      description={invoice ? `Raised ${invoice.invoiceDate} by ${invoice.mr.fullName}` : undefined}
      icon={Receipt}
      badge={invoice?.status}
      className="max-w-3xl"
      footer={
        <>
          {canCancel ? (
            <Button
              variant="danger"
              onClick={() => setConfirmCancel(true)}
              disabled={cancelMutation.isPending}
            >
              <Ban size={14} /> Cancel invoice
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      {error ? <Alert message={error} /> : null}
      {detailQuery.isLoading ? (
        <p className="py-10 text-center text-sm text-[var(--color-muted)]">Loading invoice…</p>
      ) : null}
      {detailQuery.isError ? (
        <Alert message={getApiErrorMessage(detailQuery.error)} />
      ) : null}

      {invoice ? (
        <div className="space-y-5">
          <div className="grid gap-x-8 sm:grid-cols-2">
            <dl>
              <DetailRow label="Party" value={<PartyLabel party={invoice.party} />} />
              <DetailRow label="MR" value={invoice.mr.fullName} />
              <DetailRow label="Status" value={<InvoiceStatusBadge status={invoice.status} />} />
              <DetailRow label="Due date" value={invoice.dueDate} />
            </dl>
            <dl>
              <DetailRow label="Subtotal" value={formatINR(invoice.subtotal)} />
              <DetailRow label="Discount" value={formatINR(invoice.discountAmount)} />
              <DetailRow label="Total" value={formatINR(invoice.totalAmount)} />
              <DetailRow label="Paid" value={formatINR(invoice.paidAmount)} />
              <DetailRow
                label="Outstanding"
                value={
                  <span
                    className={
                      invoice.outstanding > 0 ? 'font-bold text-[var(--color-danger)]' : undefined
                    }
                  >
                    {formatINR(invoice.outstanding)}
                  </span>
                }
              />
            </dl>
          </div>
          {invoice.remarks ? (
            <p className="rounded-lg bg-[var(--color-bg)]/60 px-3 py-2 text-xs text-[var(--color-muted)]">
              {invoice.remarks}
            </p>
          ) : null}

          <FormSection title={`Lines (${invoice.lines.length})`}>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-[11px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
                    <th className="px-3 py-2">Medicine</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Rate</th>
                    <th className="px-3 py-2 text-right">Disc %</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {invoice.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 font-medium text-[var(--color-ink)]">
                        {line.medicine.name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {line.rate === null ? '—' : formatINR(line.rate)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {line.discountPct > 0 ? `${line.discountPct}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatINR(line.amount)}
                      </td>
                    </tr>
                  ))}
                  {invoice.lines.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-xs text-[var(--color-muted)]">
                        Lines were removed when this invoice was cancelled.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </FormSection>

          <FormSection title={`Payments (${invoice.payments.length})`}>
            <div className="space-y-2">
              {invoice.payments.length === 0 ? (
                <p className="text-xs text-[var(--color-muted)]">No payments recorded yet.</p>
              ) : (
                invoice.payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/40 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">
                        {formatINR(payment.amount)}
                        <span className="ml-2 text-[11px] font-medium text-[var(--color-muted)] uppercase">
                          {payment.mode.replace('_', ' ')}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-[var(--color-muted)]">
                        {payment.paymentDate}
                        {payment.reference ? ` · Ref ${payment.reference}` : ''}
                        {payment.remarks ? ` · ${payment.remarks}` : ''}
                      </p>
                    </div>
                    {canManageSales && invoice.status !== 'CANCELLED' ? (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete payment"
                        onClick={() => setPaymentToDelete(payment.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    ) : null}
                  </div>
                ))
              )}

              {canRecordPayment ? (
                <form
                  onSubmit={onSubmitPayment}
                  className="mt-3 grid items-end gap-2 rounded-xl border border-dashed border-[var(--color-border-strong)] p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto]"
                >
                  <Input
                    label="Amount ₹"
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={String(invoice.outstanding)}
                  />
                  <DatePicker label="Date" required value={payDate} onChange={setPayDate} />
                  <Select
                    label="Mode"
                    value={payMode}
                    onChange={(e) => setPayMode(e.target.value as PaymentMode)}
                  >
                    {PAYMENT_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode.replace('_', ' ')}
                      </option>
                    ))}
                  </Select>
                  <Input
                    label="Reference"
                    optional
                    value={payReference}
                    onChange={(e) => setPayReference(e.target.value)}
                    placeholder="UPI txn / cheque no."
                  />
                  <Button type="submit" disabled={paymentMutation.isPending}>
                    <CreditCard size={14} />
                    {paymentMutation.isPending ? 'Saving…' : 'Record'}
                  </Button>
                </form>
              ) : null}
            </div>
          </FormSection>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmCancel}
        variant="generic"
        title="Cancel this invoice?"
        description={`${invoice?.invoiceNo ?? ''} will be marked CANCELLED and its sale lines removed from all reports.`}
        confirmLabel="Cancel invoice"
        loading={cancelMutation.isPending}
        onConfirm={() => cancelMutation.mutate()}
        onClose={() => setConfirmCancel(false)}
      />
      <ConfirmDialog
        open={paymentToDelete !== null}
        title="Delete this payment?"
        description="The invoice's paid amount and status will be recalculated."
        confirmLabel="Delete payment"
        loading={deletePaymentMutation.isPending}
        onConfirm={() => {
          if (paymentToDelete !== null) deletePaymentMutation.mutate(paymentToDelete);
        }}
        onClose={() => setPaymentToDelete(null)}
      />
    </Modal>
  );
}
