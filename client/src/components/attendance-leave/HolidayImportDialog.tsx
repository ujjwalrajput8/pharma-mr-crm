import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';
import {
  HOLIDAY_TYPE_LABEL,
  holidaysApi,
  type HolidayImportResult,
  type HolidayImportStatus,
} from '@/services/holidays.service';
import { downloadHolidayTemplate, parseHolidayFile, type ParsedHolidayFile } from '@/utils/holidayImport';
import { formatDisplayDate } from '@/utils/datetime';

const STATUS_META: Record<HolidayImportStatus, { label: string; tone: 'success' | 'primary' | 'warning' | 'danger' }> = {
  NEW: { label: 'New', tone: 'success' },
  RESTORE: { label: 'Restore', tone: 'primary' },
  DUPLICATE_IN_FILE: { label: 'Duplicate in file', tone: 'warning' },
  EXISTS: { label: 'Already there', tone: 'warning' },
  INVALID: { label: 'Invalid', tone: 'danger' },
};

/**
 * Excel / CSV holiday import: template → file → preview (the server checks every
 * row against the calendar) → import. Re-importing the same file adds nothing.
 */
export function HolidayImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedHolidayFile | null>(null);
  const [preview, setPreview] = useState<HolidayImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset(): void {
    setFileName(null);
    setParsed(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function close(): void {
    reset();
    onClose();
  }

  const previewMutation = useMutation({
    mutationFn: (sheet: ParsedHolidayFile) =>
      holidaysApi.import({ fileName: fileName ?? undefined, dryRun: true, rows: sheet.rows }),
    onSuccess: (result) => setPreview(result),
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const importMutation = useMutation({
    mutationFn: (sheet: ParsedHolidayFile) =>
      holidaysApi.import({ fileName: fileName ?? undefined, dryRun: false, rows: sheet.rows }),
    onSuccess: async (result) => {
      const { added, restored, duplicates, invalid } = result.summary;
      toast.success(
        'Holidays imported',
        `${added} added · ${restored} restored · ${duplicates} skipped · ${invalid} invalid`,
      );
      await queryClient.invalidateQueries({ queryKey: ['holidays'] });
      close();
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  async function onPick(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setFileName(file.name);
    try {
      const sheet = await parseHolidayFile(file);
      if (sheet.rows.length === 0) throw new Error('The file has no holiday rows under the header.');
      setParsed(sheet);
      previewMutation.mutate(sheet);
    } catch (err) {
      setParsed(null);
      setError(err instanceof Error ? err.message : 'Could not read the file');
    }
  }

  const summary = preview?.summary;
  const toSave = summary ? summary.added + summary.restored : 0;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import holidays"
      description="Excel (.xlsx) or CSV with columns Date · Holiday name · Type · Optional · Description."
      icon={FileSpreadsheet}
      className="max-w-3xl"
      error={error}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!parsed || !preview || toSave === 0}
            loading={importMutation.isPending}
            onClick={() => parsed && importMutation.mutate(parsed)}
          >
            {toSave > 0 ? `Import ${toSave} holiday${toSave === 1 ? '' : 's'}` : 'Nothing to import'}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => downloadHolidayTemplate()}>
          <Download size={14} />
          Download template
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          aria-label="Holiday file"
          onChange={(e) => void onPick(e.target.files)}
        />
        <Button size="sm" loading={previewMutation.isPending} onClick={() => inputRef.current?.click()}>
          <Upload size={14} />
          {fileName ? 'Choose another file' : 'Choose file'}
        </Button>
        {fileName ? <span className="truncate text-xs text-[var(--color-muted)]">{fileName}</span> : null}
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--color-muted)]">
        Dates like 15-11-2026, 15/11/2026, 2026-11-15 or 15 Nov 2026 all work. Type can be National, Festival,
        Regional, Company or Weekly off (blank = National). A holiday already in the calendar is skipped, never
        duplicated.
      </p>

      {summary ? (
        <div className="flex flex-wrap gap-2" data-testid="holiday-import-summary">
          <Badge tone="success">{summary.added} new</Badge>
          {summary.restored ? <Badge tone="primary">{summary.restored} restore</Badge> : null}
          <Badge tone="warning">{summary.duplicates} skipped</Badge>
          <Badge tone="danger">{summary.invalid} invalid</Badge>
        </div>
      ) : null}

      {preview ? (
        <div className="max-h-[46vh] overflow-auto rounded-[var(--radius-sm)] border border-[var(--color-border)]">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-[var(--color-bg)] text-[10px] font-bold tracking-wider text-[var(--color-muted)] uppercase">
              <tr>
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Holiday</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {preview.rows.map((row) => (
                <tr key={row.rowNumber} data-status={row.status}>
                  <td className="px-3 py-2 tabular-nums text-[var(--color-muted)]">{row.rowNumber}</td>
                  <td className="px-3 py-2 whitespace-nowrap">{row.date ? formatDisplayDate(row.date) : '—'}</td>
                  <td className="max-w-[14rem] truncate px-3 py-2 font-medium" title={row.name ?? undefined}>
                    {row.name ?? '—'}
                    {row.isOptional ? <span className="ml-1 text-[10px] text-[var(--color-muted)]">(optional)</span> : null}
                  </td>
                  <td className="px-3 py-2">{row.type ? HOLIDAY_TYPE_LABEL[row.type] : '—'}</td>
                  <td className="px-3 py-2">
                    <Badge tone={STATUS_META[row.status].tone}>{STATUS_META[row.status].label}</Badge>
                    {row.message ? <p className="mt-0.5 text-[10.5px] text-[var(--color-muted)]">{row.message}</p> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Modal>
  );
}
