import { read, SSF, utils, type WorkSheet } from 'xlsx';
import { downloadCsv } from '@/utils/exportReport';

/** Canonical import columns — the keys the API's import endpoint reads. */
export const IMPORT_FIELDS = [
  'name',
  'brandName',
  'genericName',
  'company',
  'composition',
  'strength',
  'category',
  'packSize',
  'mrp',
  'ptr',
  'pts',
  'sku',
  'code',
  'batchNo',
  'mfgDate',
  'expiryDate',
  'quantity',
  'sampleAvailable',
  'status',
  'description',
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_FIELD_LABEL: Record<ImportField, string> = {
  name: 'Medicine Name',
  brandName: 'Brand Name',
  genericName: 'Generic Name',
  company: 'Company',
  composition: 'Composition',
  strength: 'Strength',
  category: 'Category',
  packSize: 'Pack Size',
  mrp: 'MRP',
  ptr: 'PTR',
  pts: 'PTS',
  sku: 'SKU',
  code: 'Product Code',
  batchNo: 'Batch No',
  mfgDate: 'Mfg Date',
  expiryDate: 'Expiry Date',
  quantity: 'Quantity',
  sampleAvailable: 'Sample Available',
  status: 'Status',
  description: 'Description',
};

/**
 * Header spellings seen in distributor / ERP exports, compared after
 * lower-casing and dropping everything that is not a letter or digit
 * ("MRP (₹)" → "mrp", "Exp. Date" → "expdate").
 */
const HEADER_ALIASES: Record<ImportField, string[]> = {
  name: ['name', 'medicine', 'medicinename', 'product', 'productname', 'item', 'itemname', 'drug', 'drugname'],
  brandName: ['brand', 'brandname'],
  genericName: ['generic', 'genericname', 'salt', 'molecule', 'activesalt'],
  company: ['company', 'companyname', 'manufacturer', 'mfr', 'manufacturedby', 'mfgcompany'],
  composition: ['composition', 'content', 'contents'],
  strength: ['strength', 'dosage', 'potency', 'dosageform'],
  category: ['category', 'therapeuticcategory', 'therapy', 'division'],
  packSize: ['pack', 'packsize', 'packing'],
  mrp: ['mrp', 'mrprs', 'price', 'maximumretailprice'],
  ptr: ['ptr', 'pricetoretailer'],
  pts: ['pts', 'pricetostockist'],
  sku: ['sku', 'skucode'],
  code: ['code', 'productcode', 'itemcode'],
  batchNo: ['batch', 'batchno', 'batchnumber', 'lot', 'lotno', 'lotnumber'],
  mfgDate: ['mfg', 'mfgdate', 'mfd', 'manufacturingdate', 'dateofmanufacture'],
  expiryDate: ['exp', 'expiry', 'expirydate', 'expdate', 'dateofexpiry'],
  quantity: ['qty', 'quantity', 'stock', 'newstock', 'receivedqty', 'receivedquantity', 'units', 'openingstock'],
  sampleAvailable: ['sample', 'samples', 'sampleavailable'],
  status: ['status'],
  description: ['description', 'remarks', 'notes'],
};

const normalizeHeader = (header: unknown) =>
  String(header ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const aliasToField = new Map<string, ImportField>(
  IMPORT_FIELDS.flatMap((field) => HEADER_ALIASES[field].map((alias) => [alias, field] as const)),
);

const DATE_FIELDS: ReadonlySet<ImportField> = new Set(['mfgDate', 'expiryDate']);

export interface ParsedImportFile {
  rows: Array<{ rowNumber: number; values: Record<string, string | number> }>;
  /** Columns in the file, in order, with the field each one maps to. */
  columns: Array<{ header: string; field: ImportField | null }>;
}

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
 * The header is the first of the top ten rows that names a medicine column,
 * so a title line or two above the table is fine.
 */
export async function parseMedicineFile(file: File): Promise<ParsedImportFile> {
  const isText = /\.(csv|txt)$/i.test(file.name);
  // raw: keep CSV cells as typed text — "12/2027" must not become a US date.
  const workbook = isText
    ? read(await file.text(), { type: 'string', raw: true })
    : read(await file.arrayBuffer(), { type: 'array', raw: true });

  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error('The file has no sheets.');

  const { firstRow, rows } = sheetRows(sheet);
  const headerIndex = rows.slice(0, 10).findIndex((cells) => {
    const fields = cells.map((cell) => aliasToField.get(normalizeHeader(cell)));
    return fields.includes('name') || fields.includes('sku') || fields.includes('code');
  });
  if (headerIndex === -1) {
    throw new Error(
      'Could not find the header row. The first row should name the columns — at least "Medicine Name", "SKU" or "Product Code".',
    );
  }

  const headerCells = rows[headerIndex] ?? [];
  const taken = new Set<ImportField>();
  const columns = headerCells.map((cell) => {
    const field = aliasToField.get(normalizeHeader(cell)) ?? null;
    // First column wins when two headers map to the same field.
    if (field && !taken.has(field)) {
      taken.add(field);
      return { header: String(cell).trim(), field };
    }
    return { header: String(cell).trim(), field: null };
  });

  const parsed: ParsedImportFile['rows'] = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const cells = rows[index] ?? [];
    const values: Record<string, string | number> = {};
    columns.forEach((column, columnIndex) => {
      if (!column.field) return;
      const cell = cells[columnIndex];
      if (cell === '' || cell === null || cell === undefined) return;
      if (DATE_FIELDS.has(column.field) && typeof cell === 'number') {
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

export function downloadMedicineTemplate(): void {
  const row = (values: Partial<Record<ImportField, string | number>>) =>
    Object.fromEntries(IMPORT_FIELDS.map((field) => [IMPORT_FIELD_LABEL[field], values[field] ?? '']));
  downloadCsv('medicine-import-template.csv', [
    row({
      name: 'Jovamox 500',
      brandName: 'Jovamox',
      genericName: 'Amoxicillin',
      company: 'Jovance Laboratories',
      composition: 'Amoxicillin 500mg',
      strength: '500mg Capsule',
      category: 'Antibiotic',
      packSize: '10x10',
      mrp: 120,
      ptr: 96,
      pts: 86.4,
      sku: 'JV-AMX-500',
      batchNo: 'JA2601',
      mfgDate: '01/2026',
      expiryDate: '12/2027',
      quantity: 100,
      sampleAvailable: 'Yes',
      status: 'ACTIVE',
    }),
    row({
      name: 'Jovamox 500',
      sku: 'JV-AMX-500',
      batchNo: 'JA2602',
      expiryDate: '03/2028',
      quantity: 50,
    }),
  ]);
}
