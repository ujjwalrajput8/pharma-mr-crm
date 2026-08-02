/** Client-side report export helpers (CSV/Excel + print PDF). */

export function downloadCsv(
  filename: string,
  rows: Array<Record<string, string | number | boolean | null | undefined>>,
  summary?: Record<string, string | number | boolean | null | undefined>,
): void {
  const lines: string[] = [];
  if (summary) {
    lines.push('Summary');
    for (const [key, value] of Object.entries(summary)) {
      lines.push(`${csvEscape(key)},${csvEscape(value)}`);
    }
    lines.push('');
  }

  if (rows.length > 0) {
    const columns = Object.keys(rows[0] ?? {});
    lines.push(columns.map(csvEscape).join(','));
    for (const row of rows) {
      lines.push(columns.map((col) => csvEscape(row[col])).join(','));
    }
  } else if (!summary) {
    lines.push('No data');
  }

  const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
    type: 'application/vnd.ms-excel;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function printReportPdf(title: string, htmlBody: string): void {
  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!popup) return;
  popup.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 8px; }
      table { border-collapse: collapse; width: 100%; margin-top: 16px; font-size: 12px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
      th { background: #f3f4f6; }
      .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
      .summary div { border: 1px solid #ddd; padding: 8px; }
      .muted { color: #666; font-size: 12px; }
    </style></head><body>
    <h1>${escapeHtml(title)}</h1>
    ${htmlBody}
    <script>window.onload = () => { window.print(); };</script>
    </body></html>`);
  popup.document.close();
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  const text = value == null ? '' : String(value);
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
