import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileSpreadsheet, RefreshCw, Upload } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { getApiErrorMessage } from '@/api/client';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Alert } from '@/components/ui/Page';
import { useToast } from '@/components/ui/Toast';
import { doctorsApi, type DoctorImportPayload, type DoctorImportSummary } from '@/services/doctors.service';
import { parseDoctorFile } from '@/utils/doctorImport';
import { cn } from '@/utils/cn';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Pick an MSL sheet → doctors are added straight away. Rows whose name and
 * area are already on the list are skipped; the dialog ends on a one-line count.
 */
export function DoctorImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DoctorImportSummary | null>(null);

  const importMutation = useMutation({
    mutationFn: (payload: DoctorImportPayload) => doctorsApi.importRows(payload),
    onSuccess: async (data) => {
      setSummary(data.summary);
      toast.success(
        'Doctors imported',
        `${plural(data.summary.added, 'doctor')} added · ${plural(data.summary.duplicates, 'duplicate')} skipped`,
      );
      await queryClient.invalidateQueries({ queryKey: ['doctors'] });
      await queryClient.invalidateQueries({ queryKey: ['occasions'] });
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  const busy = reading || importMutation.isPending;

  function reset() {
    setFileName('');
    setError(null);
    setSummary(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function handleFile(file: File | undefined) {
    if (!file || busy) return;
    reset();
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
      importMutation.mutate({ rows: contents.rows, fileName: file.name });
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

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import doctors"
      description="Upload the MSL Excel sheet. Doctors already on the list (same name and area) are skipped."
      icon={FileSpreadsheet}
      className="max-w-lg"
      footer={
        summary ? (
          <>
            <Button variant="secondary" onClick={reset}>
              Import another file
            </Button>
            <Button onClick={close}>Done</Button>
          </>
        ) : (
          <Button variant="secondary" onClick={close} disabled={busy}>
            Cancel
          </Button>
        )
      }
    >
      {error ? <Alert message={error} /> : null}

      {summary ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-success-soft)] text-[var(--color-success)]">
            <CheckCircle2 size={28} />
          </span>
          <p className="text-base font-bold text-[var(--color-ink)]">
            {plural(summary.added, 'doctor')} added
          </p>
          <p className="text-sm text-[var(--color-muted)]">
            {plural(summary.duplicates, 'duplicate')} skipped
            {summary.invalid > 0 ? ` · ${plural(summary.invalid, 'row')} without a doctor's name skipped` : ''}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
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
              {busy ? <RefreshCw size={22} className="animate-spin" /> : <Upload size={22} />}
            </span>
            <p className="text-sm font-semibold text-[var(--color-ink)]">
              {reading
                ? `Reading ${fileName}…`
                : importMutation.isPending
                  ? 'Adding doctors…'
                  : 'Drop the Excel file here, or click to choose'}
            </p>
            <p className="text-xs text-[var(--color-muted)]">.xlsx, .xls or .csv · up to 2,000 rows</p>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              disabled={busy}
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>
        </div>
      )}
    </Modal>
  );
}
