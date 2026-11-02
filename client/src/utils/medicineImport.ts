import { downloadCsv } from '@/utils/exportReport';
import { parseSpreadsheet, type ParsedSheet } from '@/utils/spreadsheetImport';

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

/** Header spellings seen in distributor / ERP exports ("Exp. Date" → "expdate"). */
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

const DATE_FIELDS: ReadonlySet<ImportField> = new Set(['mfgDate', 'expiryDate']);

export type ParsedImportFile = ParsedSheet<ImportField>;

/**
 * Reads the first sheet of an .xlsx / .xls / .csv file into import rows.
 * The header is the first of the top ten rows that names a medicine column,
 * so a title line or two above the table is fine.
 */
export function parseMedicineFile(file: File): Promise<ParsedImportFile> {
  return parseSpreadsheet(file, {
    aliases: HEADER_ALIASES,
    dateFields: DATE_FIELDS,
    isHeader: (fields) => fields.includes('name') || fields.includes('sku') || fields.includes('code'),
    headerHint:
      'Could not find the header row. The first row should name the columns — at least "Medicine Name", "SKU" or "Product Code".',
  });
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
