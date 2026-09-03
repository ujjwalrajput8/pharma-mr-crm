import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Gift, Info } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { ChoiceCards } from '@/components/ui/ChoiceCards';
import { DatePicker } from '@/components/ui/DatePicker';
import { Select, Textarea } from '@/components/ui/Field';
import { Modal, FormSection } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';
import { employeesApi } from '@/services/employees.service';
import { leavesApi } from '@/services/leaves.service';

/**
 * Credits comp-off days against a Sunday or holiday the employee worked.
 *
 * This is the "how do I actually give someone a comp-off?" flow — a manager can
 * do it for their own team without going through Admin or hand-editing a balance.
 */
interface GrantCompOffDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pre-selected employee when opened from their profile. */
  employee?: { id: number; fullName: string };
}

export function GrantCompOffDialog(props: GrantCompOffDialogProps) {
  // Mounting only while open gives every open a clean form, with no effect
  // syncing state back and forth.
  if (!props.open) return null;
  return <GrantCompOffForm {...props} />;
}

function GrantCompOffForm({ open, onClose, employee }: GrantCompOffDialogProps) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [userId, setUserId] = useState<string>(employee ? String(employee.id) : '');
  const [days, setDays] = useState<number>(1);
  const [againstDate, setAgainstDate] = useState<string>('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const teamQuery = useQuery({
    queryKey: ['employees', 'roster'],
    queryFn: () => employeesApi.list(),
    enabled: !employee,
  });

  const grantMutation = useMutation({
    mutationFn: () =>
      leavesApi.grantCompOff({
        userId: Number(userId),
        days,
        againstDate: againstDate || undefined,
        reason: reason.trim(),
      }),
    onSuccess: async (result) => {
      onClose();
      toast.success(
        `${result.granted} comp-off day(s) granted`,
        `${result.employeeName} now has ${result.remaining} ${result.code} day(s) available.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
        queryClient.invalidateQueries({ queryKey: ['employee'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function onSubmit(event: FormEvent): void {
    event.preventDefault();
    if (!userId) {
      setError('Pick the employee to credit');
      return;
    }
    if (reason.trim().length < 3) {
      setError('Add a short reason — it goes into the audit trail');
      return;
    }
    grantMutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Grant comp-off"
      description="Credit days for Sunday or holiday fieldwork. The employee then applies for them like any other leave."
      icon={Gift}
      className="max-w-lg"
    >
      <form onSubmit={onSubmit} className="space-y-5">
        {error ? <Alert message={error} /> : null}

        <FormSection title="Who and how much" icon={Gift}>
          <div className="space-y-3.5">
            {employee ? (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]/60 px-3.5 py-2.5">
                <p className="text-[11px] font-semibold tracking-wide text-[var(--color-muted)] uppercase">
                  Employee
                </p>
                <p className="mt-0.5 text-sm font-bold">{employee.fullName}</p>
              </div>
            ) : (
              <Select
                label="Employee"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                <option value="">Select…</option>
                {(teamQuery.data ?? []).map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} ({member.employeeCode ?? member.role})
                  </option>
                ))}
              </Select>
            )}

            <ChoiceCards
              label="How many days?"
              required
              columns={3}
              value={days}
              onChange={setDays}
              choices={[
                { value: 0.5, label: 'Half day', description: 'Short Sunday call' },
                { value: 1, label: '1 day', description: 'A full worked day' },
                { value: 2, label: '2 days', description: 'A long weekend' },
              ]}
              hint="Need a different number? Use Leave policy → per-employee entitlement."
            />
          </div>
        </FormSection>

        <FormSection title="Why" icon={CalendarPlus}>
          <div className="space-y-3.5">
            <DatePicker
              label="Worked on"
              value={againstDate}
              onChange={setAgainstDate}
              placeholder="The Sunday / holiday being compensated"
            />
            <Textarea
              label="Reason"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Worked the Sunday camp at Civil Hospital with the ASM."
            />
            <p className="flex items-start gap-1.5 text-[11px] leading-snug text-[var(--color-muted)]">
              <Info size={12} className="mt-0.5 shrink-0" />
              This adds to their comp-off allocation for {new Date().getFullYear()} and is written to
              the audit log with your name.
            </p>
          </div>
        </FormSection>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={grantMutation.isPending}>
            <Gift size={14} />
            Grant {days} day{days === 1 ? '' : 's'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
