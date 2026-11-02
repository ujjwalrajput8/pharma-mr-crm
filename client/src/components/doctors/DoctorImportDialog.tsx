import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  PlusCircle,
  RefreshCw,
  Upload,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Alert, Badge, StatTile } from '@/components/ui/Page';
import { Tabs } from '@/components/ui/Tabs';
import { useToast } from '@/components/ui/Toast';
import {
  doctorsApi,
  type DoctorImportPayload,
  type DoctorImportResult,
  type DoctorImportRowResult,
} from '@/services/doctors.service';
import { usersApi } from '@/services/users.service';
import {
  DOCTOR_IMPORT_FIELD_LABEL,
  downloadDoctorTemplate,
  parseDoctorFile,
  type DoctorImportField,
  type ParsedDoctorFile,
} from '@/utils/doctorImport';
import { cn } from '@/utils/cn';

type Step = 'pick' | 'preview' | 'done';
type Filter = 'all' | 'create' | 'update' | 'warning' | 'error';

/** Rows drawn at once; the summary tiles always count the whole file. */
const PREVIEW_LIMIT = 300;

const ACTION_BADGE: Record<
  DoctorImportRowResult['action'],
  { label: string; tone: 'success' | 'primary' | 'neutral' | 'danger' }
> = {
  create: { label: 'New', tone: 'success' },
  update: { label: 'Update', tone: 'primary' },
  unchanged: { label: 'No change', tone: 'neutral' },
  error: { label: 'Error', tone: 'danger' },
};

const fieldLabel = (field: string) =>
  DOCTOR_IMPORT_FIELD_LABEL[field as DoctorImportField | 'mr'] ?? field;

const formatValue = (value: string | null) => (value === null || value === '' ? '—' : value);

type ImportRequest = Pick<DoctorImportPayload, 'rows' | 'fileName' | 'mrId'>;

export function DoctorImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('pick');
  const [fileName, setFileName] = useState('');
  const [mrId, setMrId] = useState<number | undefined>(undefined);
  const [parsed, setParsed] = useState<ParsedDoctorFile | null>(null);
  const [preview, setPreview] = useState<DoctorImportResult | null>(null);
  const [result, setResult] = useState<DoctorImportResult | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);

  const mrsQuery = useQuery({
    queryKey: ['users', 'for-assign', 'MR'],
    queryFn: () => usersApi.list({ role: 'MR' }),
    enabled: open,
  });
  const mrName = mrsQuery.data?.find((mr) => mr.id === mrId)?.fullName;

  const previewMutation = useMutation({
    mutationFn: (payload: ImportRequest) => doctorsApi.importRows({ ...payload, dryRun: true }),
    onSuccess: (data) => {
      setPreview(data);
      setFilter(data.summary.error > 0 ? 'error' : 'all');
      setStep('preview');
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const importMutation = useMutation({
    mutationFn: (payload: ImportRequest) => doctorsApi.importRows({ ...payload, dryRun: false }),
    onSuccess: async (data) => {
      setResult(data);
      setStep('done');
      toast.success('Doctors imported', `${data.summary.create} new · ${data.summary.update} updated`);
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
      await queryClient.invalidateQueries({ queryKey: ['occasions'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  function reset() {
    setStep('pick');
    setFileName('');
    setParsed(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setFilter('all');
    if (inputRef.current) inputRef.current.value = '';
  }

  function close() {
    if (importMutation.isPending) return;
    reset();
    setMrId(undefined);
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setFileName(file.name);
    if (!/\.(xlsx|xls|csv|txt)$/i.test(file.name)) {
      setError('Choose an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    setReading(true);
    try {
      const contents = await parseDoctorFile(file);
      if (contents.rows.length === 0) {
        setError('The file has a header row but no doctor rows under it.');
        return;
      }
      setParsed(contents);
      previewMutation.mutate({ rows: contents.rows, fileName: file.name, mrId });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read the file.');
    } finally {
      setReading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  const ignoredColumns = parsed?.columns.filter((column) => !column.field) ?? [];
  const summary = preview?.summary;
  const importable = summary ? summary.create + summary.update : 0;
  const visibleRows = (preview?.rows ?? []).filter((row) =>
    filter === 'all'
      ? true
      : filter === 'warning'
        ? row.action !== 'error' && row.warnings.length > 0
        : row.action === filter,
  );

  const footer =
    step === 'pick' ? (
      <Button variant="secondary" onClick={close}>
        Cancel
      </Button>
    ) : step === 'preview' ? (
      <>
        <Button variant="secondary" onClick={reset} disabled={importMutation.isPending}>
          Choose another file
        </Button>
        <Button
          onClick={() =>
            parsed && importMutation.mutate({ rows: parsed.rows, fileName: fileName || undefined, mrId })
          }
          loading={importMutation.isPending}
          disabled={importable === 0}
        >
          <Upload size={14} />
          {importMutation.isPending
            ? 'Importing…'
            : `Import ${importable} doctor${importable === 1 ? '' : 's'}`}
        </Button>
      </>
    ) : (
      <>
        <Button variant="secondary" onClick={reset}>
          Import another file
        </Button>
        <Button onClick={close}>Done</Button>
      </>
    );

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import doctors"
      description="Upload the MSL Excel sheet to add new doctors and update existing ones in one go."
      icon={FileSpreadsheet}
      className="max-w-5xl"
      footer={footer}
    >
      {error ? <Alert message={error} /> : null}

      {step === 'pick' ? (
        <div className="space-y-4">
          <Select
            label="Assign every doctor in the file to (MR)"
            hint="Leave empty to keep each doctor's current MR."
            value={mrId ?? ''}
            onChange={(e) => setMrId(e.target.value ? Number(e.target.value) : undefined)}
            disabled={reading || previewMutation.isPending}
          >
            <option value="">Don't change MR assignment</option>
            {mrsQuery.data?.map((mr) => (
              <option key={mr.id} value={mr.id}>
                {mr.fullName} ({mr.email})
              </option>
            ))}
          </Select>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius)] border-2 border-dashed px-6 py-10 text-center transition-colors',
              dragging
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                : 'border-[var(--color-border-strong)] hover:border-[var(--color-primary)]/60 hover:bg-[var(--color-bg)]',
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
              {reading || previewMutation.isPending ? (
                <RefreshCw size={22} className="animate-spin" />
              ) : (
                <Upload size={22} />
              )}
            </span>
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              {reading
                ? `Reading ${fileName}…`
                : previewMutation.isPending
                  ? 'Checking rows against the doctor list…'
                  : 'Drop a file here, or click to choose'}
            </p>
            <p className="text-xs text-[var(--color-muted)]">.xlsx, .xls or .csv · up to 2,000 rows</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <HowItWorks
              icon={PlusCircle}
              title="New doctor"
              text="MSL No not on the list yet → doctor is created. Needs at least the doctor's name."
            />
            <HowItWorks
              icon={RefreshCw}
              title="Existing doctor"
              text="Matched by MSL No, or by mobile + name → only the filled-in cells are updated. Blank cells keep their value."
            />
            <HowItWorks
              icon={UserCheck}
              title="Area & HQ/EX"
              text={'"BORING ROAD-HQ" is read as area Boring Road, type HQ. EX and OS (out-station) work the same way.'}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
            <p className="text-xs text-[var(--color-muted)]">
              Columns: MYMSL NO, AREA-HQ/EX, DOCTOR'S NAME, MOBILE NO, MSLCLASS, SPECIALITY, ADDRESS,
              EMAIL ID, BIRTHDAY, ANNIVERSARY. Dates as 15/08/1975. Nothing is saved until you
              confirm the preview.
            </p>
            <Button variant="secondary" size="sm" onClick={downloadDoctorTemplate}>
              <Download size={13} />
              Download template
            </Button>
          </div>
        </div>
      ) : null}

      {step === 'preview' && summary ? (
        <div className="space-y-4">
          <p className="text-xs text-[var(--color-muted)]">
            <span className="font-semibold text-[var(--color-ink)]">{fileName}</span> ·{' '}
            {summary.total} rows read
            {mrName ? (
              <>
                {' '}
                · assigning to <span className="font-semibold text-[var(--color-ink)]">{mrName}</span>
              </>
            ) : null}
            . Review the changes below, then import.
          </p>

          <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
            <StatTile label="New" value={summary.create} icon={PlusCircle} tone="success" onClick={() => setFilter('create')} />
            <StatTile label="Update" value={summary.update} icon={RefreshCw} tone="primary" onClick={() => setFilter('update')} />
            <StatTile label="No change" value={summary.unchanged} icon={CheckCircle2} onClick={() => setFilter('all')} />
            <StatTile label="Warnings" value={summary.warning} icon={AlertTriangle} tone="warning" onClick={() => setFilter('warning')} />
            <StatTile label="Errors" value={summary.error} icon={XCircle} tone="danger" onClick={() => setFilter('error')} />
          </div>

          {summary.error > 0 ? (
            <div className="flex items-start gap-2 rounded-[var(--radius-sm)] border border-[var(--color-warning)]/30 bg-[var(--color-warning-soft)] px-3.5 py-2.5 text-xs text-[var(--color-warning)]">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              <span>
                {summary.error} row{summary.error === 1 ? ' has' : 's have'} errors and will be
                skipped. Fix them in the file and import again, or go ahead with the rest.
              </span>
            </div>
          ) : null}

          {ignoredColumns.length > 0 ? (
            <p className="text-xs text-[var(--color-muted)]">
              Ignored columns (not recognised):{' '}
              {ignoredColumns.map((column) => `"${column.header}"`).join(', ')}
            </p>
          ) : null}

          <Tabs
            value={filter}
            onChange={setFilter}
            items={[
              { value: 'all', label: 'All', count: summary.total },
              { value: 'create', label: 'New', count: summary.create },
              { value: 'update', label: 'Update', count: summary.update },
              { value: 'warning', label: 'Warnings', count: summary.warning },
              { value: 'error', label: 'Errors', count: summary.error },
            ]}
          />

          <PreviewTable rows={visibleRows.slice(0, PREVIEW_LIMIT)} />
          {visibleRows.length > PREVIEW_LIMIT ? (
            <p className="text-center text-xs text-[var(--color-muted)]">
              Showing the first {PREVIEW_LIMIT} of {visibleRows.length} rows. All of them will be
              imported.
            </p>
          ) : null}
        </div>
      ) : null}

      {step === 'done' && result ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
            <CheckCircle2 size={28} />
          </span>
          <p className="text-base font-bold text-[var(--color-ink)]">Import complete</p>
          <p className="max-w-md text-sm text-[var(--color-muted)]">
            {result.summary.create} new doctor{result.summary.create === 1 ? '' : 's'} added,{' '}
            {result.summary.update} updated
            {mrName ? `, assigned to ${mrName}` : ''}.
            {result.summary.error > 0 ? ` ${result.summary.error} rows with errors were skipped.` : ''}
          </p>
        </div>
      ) : null}
    </Modal>
  );
}

function HowItWorks({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof PlusCircle;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-[var(--radius-sm)] border border-[var(--color-border)] p-3.5">
      <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-ink)]">
        <Icon size={14} className="text-[var(--color-primary)]" />
        {title}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-muted)]">{text}</p>
    </div>
  );
}

function PreviewTable({ rows }: { rows: DoctorImportRowResult[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border)] py-8 text-center text-xs text-[var(--color-muted)]">
        No rows in this view.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="bg-[var(--color-bg)] text-[10.5px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
          <tr>
            <th className="px-3 py-2">Row</th>
            <th className="px-3 py-2">Doctor</th>
            <th className="px-3 py-2">Result</th>
            <th className="px-3 py-2">Changes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const badge = ACTION_BADGE[row.action];
            return (
              <tr key={row.rowNumber} className="border-t border-[var(--color-border)] align-top">
                <td className="px-3 py-2.5 font-mono text-[var(--color-muted)]">{row.rowNumber}</td>
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-[var(--color-ink)]">{row.doctorName ?? '—'}</p>
                  <p className="text-[11px] text-[var(--color-muted)]">
                    {row.mslNo ? `MSL ${row.mslNo}` : 'No MSL No'}
                    {row.matchedBy ? ` · matched by ${row.matchedBy === 'mslNo' ? 'MSL No' : 'mobile'}` : ''}
                  </p>
                </td>
                <td className="px-3 py-2.5">
                  <Badge tone={badge.tone}>{badge.label}</Badge>
                </td>
                <td className="px-3 py-2.5">
                  {row.errors.length > 0 ? (
                    <ul className="space-y-0.5 text-[var(--color-danger)]">
                      {row.errors.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  ) : row.changes.length === 0 ? (
                    <span className="text-[var(--color-muted)]">—</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {row.changes.map((change) => (
                        <li key={change.field}>
                          <span className="text-[var(--color-muted)]">{fieldLabel(change.field)}:</span>{' '}
                          {row.action === 'create' || change.from === null ? (
                            <span className="font-medium text-[var(--color-ink)]">{formatValue(change.to)}</span>
                          ) : (
                            <>
                              <span className="text-[var(--color-muted)] line-through">
                                {formatValue(change.from)}
                              </span>{' '}
                              →{' '}
                              <span className="font-medium text-[var(--color-ink)]">{formatValue(change.to)}</span>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {row.warnings.length > 0 ? (
                    <ul className="mt-1 space-y-0.5 text-[var(--color-warning)]">
                      {row.warnings.map((message) => (
                        <li key={message} className="flex items-start gap-1">
                          <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                          {message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
