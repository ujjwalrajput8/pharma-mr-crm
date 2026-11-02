import { read, SSF, utils, type WorkSheet } from 'xlsx';

export interface ParsedSheet<F extends string> {
  rows: Array<{ rowNumber: number; values: Record<string, string | number> }>;
  /** Columns in the file, in order, with the field each one maps to. */
  columns: Array<{ header: string; field: F | null }>;
}

export interface SheetOptions<F extends string> {
  /**
   * Header spellings per field, compared after lower-casing and dropping
   * everything that is not a letter or digit ("MRP (₹)" → "mrp").
   */
  aliases: Record<F, string[]>;
  /** Fields whose Excel date cells become YYYY-MM-DD. */
  dateFields: ReadonlySet<F>;
  /** True for the row (among the top ten) whose cells name the columns. */
  isHeader: (fields: Array<F | undefined>) => boolean;
  /** Error shown when no header row is found. */
  headerHint: string;
}

export const normalizeHeader = (header: unknown) =>
  String(header ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const pad = (value: number) => String(value).padStart(2, '0');

/** Excel stores dates as a day count; turn one into YYYY-MM-DD without timezone drift. */
function excelSerialToDate(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2958465) return null;
  const parts = SSF.parse_date_code(serial);
  return parts ? `${parts.y}-${pad(parts.m)}-${pad(parts.d)}` : null;
}

function sheetRows(sheet: WorkSheet): { firstRow: number; rows: unknown[][] } {
  const firstRow = sheet['!ref'] ? utils.decode_range(sheet['!ref']).s.r + 1 : 1;
  const rows = utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true });
  return { firstRow, rows };
}

/**
 * Reads the first sheet of an .xlsx / .xls / .csv file into import rows.
 * The header may sit below a title line or two.
 */
export async function parseSpreadsheet<F extends string>(
  file: File,
  options: SheetOptions<F>,
): Promise<ParsedSheet<F>> {
  const isText = /\.(csv|txt)$/i.test(file.name);
  // raw: keep CSV cells as typed text — "12/2027" must not become a US date.
  const workbook = isText
    ? read(await file.text(), { type: 'string', raw: true })
    : read(await file.arrayBuffer(), { type: 'array', raw: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error('The file has no sheets.');

  const aliasToField = new Map<string, F>(
    (Object.keys(options.aliases) as F[]).flatMap((field) =>
      options.aliases[field].map((alias) => [alias, field] as const),
    ),
  );

  const { firstRow, rows } = sheetRows(sheet);
  const headerIndex = rows
    .slice(0, 10)
    .findIndex((cells) => options.isHeader(cells.map((cell) => aliasToField.get(normalizeHeader(cell)))));
  if (headerIndex === -1) throw new Error(options.headerHint);

  const headerCells = rows[headerIndex] ?? [];
  const taken = new Set<F>();
  const columns = headerCells.map((cell) => {
    const field = aliasToField.get(normalizeHeader(cell)) ?? null;
    // First column wins when two headers map to the same field.
    if (field && !taken.has(field)) {
      taken.add(field);
      return { header: String(cell).trim(), field };
    }
    return { header: String(cell).trim(), field: null };
  });

  const parsed: ParsedSheet<F>['rows'] = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const cells = rows[index] ?? [];
    const values: Record<string, string | number> = {};
    columns.forEach((column, columnIndex) => {
      if (!column.field) return;
      const cell = cells[columnIndex];
      if (cell === '' || cell === null || cell === undefined) return;
      if (options.dateFields.has(column.field) && typeof cell === 'number') {
        values[column.field] = excelSerialToDate(cell) ?? String(cell);
      } else {
        values[column.field] = typeof cell === 'number' ? cell : String(cell).trim();
      }
    });
    if (Object.values(values).some((value) => value !== '')) {
      parsed.push({ rowNumber: firstRow + index, values });
    }
  }

  return { rows: parsed, columns: columns.filter((column) => column.header !== '') };
}
