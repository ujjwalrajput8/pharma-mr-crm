import { useRef, useState, type FormEvent } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CalendarPlus, CalendarRange, CheckCircle2, Paperclip, Upload } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { DatePicker } from '@/components/ui/DatePicker';
import { Input, Select, Textarea } from '@/components/ui/Field';
import { FormSection, Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/AuthContext';
import { employeesApi } from '@/services/employees.service';
import { filesApi } from '@/services/files.service';
import { leavesApi, type LeaveDayPart } from '@/services/leaves.service';
import { formatDisplayDate, toIsoDate } from '@/utils/datetime';
import { cn } from '@/utils/cn';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function blankForm(date?: string) {
  const day = date ?? toIsoDate(new Date());
  return {
    leaveTypeId: '',
    fromDate: day,
    toDate: day,
    dayPart: 'FULL' as LeaveDayPart,
    hours: '2',
    reason: '',
    contactPhone: '',
    attachmentUrl: '',
    userId: '',
  };
}

/**
 * The one leave form — opened from Overview, My Attendance (a calendar day) and
 * the Leave tab. The box under the dates comes from the server's own rules, so
 * what it says is exactly what will happen on submit.
 */
export function LeaveApplyDialog(props: {
  open: boolean;
  onClose: () => void;
  /** Pre-fills From / To — e.g. the day clicked on the attendance calendar. */
  initialDate?: string;
}) {
  // Mounted only while open, so every opening starts from a fresh form.
  return props.open ? <LeaveApplyForm onClose={props.onClose} initialDate={props.initialDate} /> : null;
}

function LeaveApplyForm({ onClose, initialDate }: { onClose: () => void; initialDate?: string }) {
  const open = true;
  const { user, can } = useAuth();
  const canManage = can('leaves:manage');
  const canApplyOwn = can('leaves:own');
  const queryClient = useQueryClient();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(() => blankForm(initialDate));
  const [attachment, setAttachment] = useState<{ key: string; fileName: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const typesQuery = useQuery({ queryKey: ['leave-types'], queryFn: () => leavesApi.types(), enabled: open });
  const teamQuery = useQuery({
    queryKey: ['employees', 'roster'],
    queryFn: () => employeesApi.list(),
    enabled: open && canManage,
  });
  const leaveTypes = typesQuery.data ?? [];
  const selectedType = leaveTypes.find((type) => String(type.id) === form.leaveTypeId);
  const toDate = form.dayPart === 'FULL' ? form.toDate : form.fromDate;
  // Admin has no leave of their own, so they always file for someone.
  const needsEmployee = !canApplyOwn;

  const previewParams = {
    leaveTypeId: Number(form.leaveTypeId),
    fromDate: form.fromDate,
    toDate,
    dayPart: form.dayPart,
    hours: form.dayPart === 'SHORT' ? Number(form.hours) : undefined,
    userId: form.userId ? Number(form.userId) : undefined,
  };
  const previewReady =
    open &&
    Boolean(form.leaveTypeId) &&
    ISO_DAY.test(form.fromDate) &&
    ISO_DAY.test(toDate) &&
    (form.dayPart !== 'SHORT' || Number(form.hours) > 0) &&
    (!needsEmployee || Boolean(form.userId));
  const previewQuery = useQuery({
    queryKey: ['leaves', 'preview', previewParams],
    queryFn: () => leavesApi.preview(previewParams),
    enabled: previewReady,
    placeholderData: keepPreviousData,
    retry: false,
  });
  const preview = previewReady ? previewQuery.data : undefined;
  const problems = preview?.problems ?? [];
  const proofMissing = Boolean(preview?.requiresProof) && !attachment && !form.attachmentUrl.trim();
  const canSubmit = previewReady && Boolean(preview) && !previewQuery.isFetching && problems.length === 0 && !proofMissing;

  const applyMutation = useMutation({
    mutationFn: leavesApi.apply,
    onSuccess: async () => {
      toast.success('Leave request submitted');
      onClose();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['leaves'] }),
        queryClient.invalidateQueries({ queryKey: ['leave-balances'] }),
        queryClient.invalidateQueries({ queryKey: ['attendance'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
      ]);
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  async function onPickProof(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const info = await filesApi.upload(file, 'leave-proof');
      setAttachment({ key: info.key, fileName: info.fileName });
      setError(null);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    applyMutation.mutate({
      leaveTypeId: Number(form.leaveTypeId),
      fromDate: form.fromDate,
      toDate,
      dayPart: form.dayPart,
      hours: form.dayPart === 'SHORT' ? Number(form.hours) : undefined,
      reason: form.reason.trim(),
      contactPhone: form.contactPhone.trim() || undefined,
      attachmentUrl: form.attachmentUrl.trim() || undefined,
      attachmentFileKey: attachment?.key,
      userId: form.userId ? Number(form.userId) : undefined,
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Apply for leave"
      description="Sundays and company holidays inside the range are not counted."
      icon={CalendarPlus}
      className="max-w-xl"
      error={error}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="apply-leave-form" loading={applyMutation.isPending} disabled={!canSubmit}>
            Submit request
          </Button>
        </>
      }
    >
      <form id="apply-leave-form" onSubmit={onSubmit} className="space-y-4">
        <FormSection title="Leave details" icon={CalendarRange}>
          <div className="grid gap-3.5 sm:grid-cols-2">
            {canManage ? (
              <Select
                label="Employee"
                required={needsEmployee}
                value={form.userId}
                onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
                hint={needsEmployee ? 'Who is this leave for?' : 'Leave blank to apply for yourself'}
                className="sm:col-span-2"
              >
                <option value="">{needsEmployee ? 'Select employee…' : 'Myself'}</option>
                {(teamQuery.data ?? [])
                  .filter((member) => member.id !== user?.id)
                  .map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.fullName} ({member.employeeCode ?? member.role})
                    </option>
                  ))}
              </Select>
            ) : null}

            <Select
              label="Leave type"
              required
              value={form.leaveTypeId}
              onChange={(e) => setForm((f) => ({ ...f, leaveTypeId: e.target.value }))}
            >
              <option value="">Select…</option>
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.code} — {type.name}
                </option>
              ))}
            </Select>

            <Select
              label="Duration"
              value={form.dayPart}
              onChange={(e) => setForm((f) => ({ ...f, dayPart: e.target.value as LeaveDayPart }))}
              hint={
                form.dayPart === 'SHORT'
                  ? 'Counts as hours ÷ 8 of a day'
                  : selectedType && !selectedType.allowHalfDay
                    ? `${selectedType.code} must be taken as full days`
                    : undefined
              }
            >
              <option value="FULL">Full day(s)</option>
              <option value="FIRST_HALF" disabled={selectedType?.allowHalfDay === false}>
                First half
              </option>
              <option value="SECOND_HALF" disabled={selectedType?.allowHalfDay === false}>
                Second half
              </option>
              <option value="SHORT" disabled={selectedType?.allowShortLeave !== true}>
                Few hours
              </option>
            </Select>

            {form.dayPart === 'SHORT' ? (
              <Input
                label="Hours off"
                type="number"
                required
                min={0.5}
                max={4}
                step="0.5"
                value={form.hours}
                onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                hint="Between 0.5 and 4 hours"
              />
            ) : null}

            <DatePicker
              label="From"
              required
              value={form.fromDate}
              onChange={(value) =>
                setForm((f) => ({ ...f, fromDate: value, toDate: f.toDate && f.toDate >= value ? f.toDate : value }))
              }
            />
            <DatePicker
              label="To"
              required
              value={toDate}
              disabled={form.dayPart !== 'FULL'}
              onChange={(value) => setForm((f) => ({ ...f, toDate: value }))}
            />
          </div>

          <LeavePreviewBox
            ready={previewReady}
            loading={previewQuery.isFetching && !preview}
            failed={previewQuery.isError ? getApiErrorMessage(previewQuery.error) : null}
            preview={preview}
            proofMissing={proofMissing}
          />
        </FormSection>

        <FormSection title="Reason & contact" icon={Paperclip}>
          <div className="space-y-3.5">
            <Textarea
              label="Reason"
              required
              value={form.reason}
              onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              placeholder="Family function in Kanpur, back on Monday…"
            />
            <div className="grid gap-3.5 sm:grid-cols-2">
              <Input
                label="Contact number while away"
                optional
                value={form.contactPhone}
                onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                placeholder="98765 43210"
              />
              <Input
                label="Document link"
                optional
                value={form.attachmentUrl}
                onChange={(e) => setForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
                placeholder="https://…"
                hint="Or upload a file below"
              />
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="hidden"
                onChange={(e) => void onPickProof(e.target.files)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileInputRef.current?.click()}>
                  <Upload size={13} />
                  {attachment ? 'Replace document' : 'Upload document'}
                </Button>
                {attachment ? (
                  <span className="inline-flex max-w-[16rem] items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary)]">
                    <Paperclip size={11} />
                    <span className="truncate">{attachment.fileName}</span>
                    <button
                      type="button"
                      aria-label="Remove attachment"
                      className="cursor-pointer font-bold hover:opacity-70"
                      onClick={() => setAttachment(null)}
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span className="text-[11px] text-[var(--color-muted)]">JPEG / PNG / WebP / PDF, up to 5 MB</span>
                )}
              </div>
            </div>
          </div>
        </FormSection>
      </form>
    </Modal>
  );
}

/** "2 working days · Sun 15 Nov + Chhath Puja not counted · CL 12 → 10" — or why not. */
function LeavePreviewBox({
  ready,
  loading,
  failed,
  preview,
  proofMissing,
}: {
  ready: boolean;
  loading: boolean;
  failed: string | null;
  preview: Awaited<ReturnType<typeof leavesApi.preview>> | undefined;
  proofMissing: boolean;
}) {
  if (!ready) {
    return (
      <p className="mt-3 text-[11px] text-[var(--color-muted)]">
        Pick the leave type and dates to see how many days this will take.
      </p>
    );
  }
  if (failed) return <PreviewShell tone="danger" lines={[failed]} />;
  if (loading || !preview) return <PreviewShell tone="neutral" lines={['Working out the days…']} />;

  const messages = preview.problems.map((problem) => problem.message);
  if (proofMissing) messages.push('This leave type needs a supporting document — add a link or upload a file.');
  if (messages.length) return <PreviewShell tone="danger" lines={messages} />;

  const dayWord = preview.days === 1 ? 'day' : 'days';
  const lines = [`${preview.days} working ${dayWord}`];
  if (preview.excluded.length) {
    const names = preview.excluded.map((day) => `${formatDisplayDate(day.date)} (${day.reason})`).join(', ');
    lines.push(preview.sandwichRule ? `Sandwich rule — counted too: ${names}` : `Not counted: ${names}`);
  }
  if (preview.balance) {
    lines.push(`${preview.balance.code} balance ${preview.balance.available} → ${preview.balance.after} after approval`);
  }
  return <PreviewShell tone="success" lines={lines} />;
}

function PreviewShell({ tone, lines }: { tone: 'success' | 'danger' | 'neutral'; lines: string[] }) {
  const Icon = tone === 'danger' ? AlertCircle : CheckCircle2;
  return (
    <div
      role="status"
      data-testid="leave-preview"
      className={cn(
        'mt-3 flex gap-2.5 rounded-[var(--radius-sm)] border px-3 py-2.5 text-xs',
        tone === 'success' && 'border-[var(--color-success)]/30 bg-[var(--color-success-soft)] text-[var(--color-success)]',
        tone === 'danger' && 'border-[var(--color-danger)]/30 bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
        tone === 'neutral' && 'border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-muted)]',
      )}
    >
      {tone === 'neutral' ? null : <Icon size={15} className="mt-px shrink-0" />}
      <div className="space-y-0.5">
        {lines.map((line, index) => (
          <p key={line} className={index === 0 ? 'font-semibold' : undefined}>
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
