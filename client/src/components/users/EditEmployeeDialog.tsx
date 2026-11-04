import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, GitBranch, PencilLine } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select } from '@/components/ui/Field';
import { FormSection, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { attendanceApi } from '@/services/attendance.service';
import { leavesApi } from '@/services/leaves.service';
import { usersApi, type MrUser, type UpdateMrPayload } from '@/services/users.service';

type Role = 'MANAGER' | 'MR';

function toForm(user: MrUser) {
  return {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone ?? '',
    employeeCode: user.employeeCode ?? '',
    designation: user.designation ?? '',
    role: user.role as Role,
    managerId: user.managerId ? String(user.managerId) : '',
    assignedArea: user.assignedArea ?? '',
    joiningDate: user.joiningDate ?? '',
    address: user.address ?? '',
  };
}

/**
 * Admin edits an employee account, including who they report to. A change of
 * reporting manager is never saved straight away: the dialog first shows what
 * it means (who stops / starts seeing this person, pending requests that move).
 */
export function EditEmployeeDialog({
  user,
  people,
  onClose,
}: {
  user: MrUser | null;
  /** Everyone on the Users page — for manager names and team size. */
  people: MrUser[];
  onClose: () => void;
}) {
  return user ? <EditEmployeeForm user={user} people={people} onClose={onClose} /> : null;
}

function EditEmployeeForm({ user, people, onClose }: { user: MrUser; people: MrUser[]; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState(() => toForm(user));
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only valid parents: active Managers, never this person or anyone in their team.
  const optionsQuery = useQuery({
    queryKey: ['users', 'manager-options', user.id],
    queryFn: () => usersApi.managerOptions(user.id),
  });

  const managerChanged = (form.managerId || null) !== (user.managerId ? String(user.managerId) : null);
  const nameOf = (id: string | number | null) =>
    id ? (people.find((person) => person.id === Number(id))?.fullName ?? 'that manager') : null;
  const teamSize = people.filter((person) => person.managerId === user.id).length;

  const pendingQuery = useQuery({
    queryKey: ['users', 'pending-for', user.id],
    queryFn: async () => {
      const [leaves, regs] = await Promise.all([
        leavesApi.list({ userId: user.id, status: 'PENDING', limit: 50 }),
        attendanceApi.listRegularizations({ userId: user.id, status: 'PENDING' }),
      ]);
      return { leaves: leaves.length, regularizations: regs.length };
    },
    enabled: confirming,
  });

  const saveMutation = useMutation({
    mutationFn: (payload: UpdateMrPayload) => usersApi.update(user.id, payload),
    onSuccess: async () => {
      toast.success(managerChanged ? 'Reporting line updated' : 'Employee updated');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['users'] }),
        queryClient.invalidateQueries({ queryKey: ['employees'] }),
      ]);
      onClose();
    },
    onError: (err) => {
      setConfirming(false);
      setError(getApiErrorMessage(err));
    },
  });

  /** Only what changed is sent — editing a phone number can never touch the reporting line. */
  function changes(): UpdateMrPayload {
    const before = toForm(user);
    const payload: UpdateMrPayload = {};
    const text = (value: string) => value.trim() || null;
    if (form.fullName.trim() !== before.fullName) payload.fullName = form.fullName.trim();
    if (form.email.trim().toLowerCase() !== before.email.toLowerCase()) payload.email = form.email.trim();
    if (form.phone.trim() !== before.phone) payload.phone = text(form.phone);
    if (form.employeeCode.trim() !== before.employeeCode) payload.employeeCode = form.employeeCode.trim();
    if (form.designation.trim() !== before.designation) payload.designation = text(form.designation);
    if (form.role !== before.role) payload.role = form.role;
    if (form.assignedArea.trim() !== before.assignedArea) payload.assignedArea = text(form.assignedArea);
    if (form.joiningDate !== before.joiningDate) payload.joiningDate = form.joiningDate || null;
    if (form.address.trim() !== before.address) payload.address = text(form.address);
    if (managerChanged) payload.managerId = form.managerId ? Number(form.managerId) : null;
    return payload;
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    const payload = changes();
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    if (managerChanged && !confirming) {
      setConfirming(true);
      return;
    }
    saveMutation.mutate(payload);
  }

  const oldManager = nameOf(user.managerId);
  const newManager = nameOf(form.managerId);
  const pending = pendingQuery.data;

  return (
    <Modal
      open
      onClose={onClose}
      title={confirming ? 'Confirm reporting change' : `Edit ${user.fullName}`}
      description={confirming ? 'Check what this change means before saving.' : 'Account details and reporting line.'}
      icon={confirming ? GitBranch : PencilLine}
      className="max-w-2xl"
      error={error}
      footer={
        <>
          <Button variant="secondary" onClick={confirming ? () => setConfirming(false) : onClose}>
            {confirming ? 'Back' : 'Cancel'}
          </Button>
          <Button type="submit" form="edit-employee-form" loading={saveMutation.isPending}>
            {confirming ? 'Confirm change' : 'Save changes'}
          </Button>
        </>
      }
    >
      <form id="edit-employee-form" onSubmit={onSubmit} className="space-y-4">
        {confirming ? (
          <div className="space-y-3 text-sm" data-testid="reporting-impact">
            <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
              <span className="font-semibold">{user.fullName}</span>
              <span className="text-[var(--color-muted)]">reports to</span>
              <span className="line-through decoration-[var(--color-danger)]">{oldManager ?? 'Admin (no manager)'}</span>
              <ArrowRight size={14} className="text-[var(--color-muted)]" />
              <span className="font-semibold text-[var(--color-primary)]">{newManager ?? 'Admin (no manager)'}</span>
            </div>
            <ul className="list-disc space-y-1.5 pl-5 text-[13px] text-[var(--color-ink)]">
              {oldManager ? (
                <li>
                  <b>{oldManager}</b> (and the managers above them) will stop seeing {user.fullName}&apos;s attendance, leave and visits.
                </li>
              ) : null}
              <li>
                {newManager ? (
                  <>
                    <b>{newManager}</b> (and the managers above them) will see {user.fullName} in their team.
                  </>
                ) : (
                  <>{user.fullName} will report straight to Admin — no manager will see them.</>
                )}
              </li>
              {teamSize > 0 ? (
                <li>
                  {user.fullName}&apos;s own team ({teamSize} {teamSize === 1 ? 'person' : 'people'}) moves along with them.
                </li>
              ) : null}
              <li>
                {pendingQuery.isLoading
                  ? 'Checking pending requests…'
                  : pending && pending.leaves + pending.regularizations > 0
                    ? `${pending.leaves} pending leave and ${pending.regularizations} regularization request(s) will now be approved by ${newManager ?? 'Admin'}.`
                    : 'No pending requests to move.'}
              </li>
            </ul>
            <p className="text-[11px] text-[var(--color-muted)]">The change is recorded in the audit log.</p>
          </div>
        ) : (
          <>
            <FormSection title="Reporting line" icon={GitBranch} subtitle="Team visibility follows this">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Select
                  label="Role"
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                >
                  <option value="MR">MR</option>
                  <option value="MANAGER">Manager (ASM / RSM)</option>
                </Select>
                <Select
                  label="Reporting manager"
                  value={form.managerId}
                  onChange={(e) => setForm((f) => ({ ...f, managerId: e.target.value }))}
                  hint={
                    form.role === 'MANAGER'
                      ? 'An ASM reports to an RSM; leave empty for the top of the tree'
                      : 'The ASM / RSM who approves this MR'
                  }
                >
                  <option value="">No reporting manager (Admin)</option>
                  {/* Keep the current manager visible even if they would not be offered any more. */}
                  {user.managerId && !optionsQuery.data?.some((option) => option.id === user.managerId) ? (
                    <option value={user.managerId}>{user.managerName ?? 'Current manager'} (current)</option>
                  ) : null}
                  {(optionsQuery.data ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.fullName}
                      {option.designation ? ` — ${option.designation}` : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </FormSection>

            <FormSection title="Account" icon={PencilLine}>
              <div className="grid gap-3.5 sm:grid-cols-2">
                <Input
                  label="Full name"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
                <Input
                  label="Employee code"
                  required
                  value={form.employeeCode}
                  onChange={(e) => setForm((f) => ({ ...f, employeeCode: e.target.value }))}
                />
                <Input
                  label="Work email"
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
                <Input
                  label="Contact phone"
                  optional
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
                <Input
                  label="Designation"
                  optional
                  value={form.designation}
                  onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))}
                />
                <Input
                  label="Beat / area"
                  optional
                  value={form.assignedArea}
                  onChange={(e) => setForm((f) => ({ ...f, assignedArea: e.target.value }))}
                />
                <DatePicker
                  label="Joining date"
                  value={form.joiningDate}
                  onChange={(value) => setForm((f) => ({ ...f, joiningDate: value }))}
                />
                <Input
                  label="Address"
                  optional
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                />
              </div>
            </FormSection>
          </>
        )}
      </form>
    </Modal>
  );
}
