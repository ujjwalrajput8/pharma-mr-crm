import { utils, writeFile } from 'xlsx';
import { parseSpreadsheet, type ParsedSheet } from '@/utils/spreadsheetImport';

/** Canonical import columns — the keys `POST /holidays/import` reads. */
export const HOLIDAY_IMPORT_FIELDS = ['date', 'name', 'type', 'optional', 'description'] as const;
export type HolidayImportField = (typeof HOLIDAY_IMPORT_FIELDS)[number];

/** Header spellings, compared lower-case with everything but letters / digits dropped. */
const HEADER_ALIASES: Record<HolidayImportField, string[]> = {
  date: ['date', 'holidaydate', 'day', 'on'],
  name: ['holidayname', 'name', 'holiday', 'occasion', 'festival', 'title'],
  type: ['type', 'holidaytype', 'category', 'kind'],
  optional: ['optional', 'isoptional', 'restricted', 'rh', 'optionalholiday'],
  description: ['description', 'note', 'notes', 'remarks', 'remark', 'details'],
};

export type ParsedHolidayFile = ParsedSheet<HolidayImportField>;

export function parseHolidayFile(file: File): Promise<ParsedHolidayFile> {
  return parseSpreadsheet(file, {
    aliases: HEADER_ALIASES,
    dateFields: new Set<HolidayImportField>(['date']),
    isHeader: (fields) => fields.includes('date') && fields.includes('name'),
    headerHint: 'Could not find the header row. The first row should name the columns — at least "Date" and "Holiday name".',
  });
}

/** The sample sheet Admin downloads: the exact headers plus two filled-in examples. */
export function downloadHolidayTemplate(year = new Date().getFullYear()): void {
  // January's second Saturday — a real date for the "weekly off" example row.
  const firstSaturday = 1 + ((6 - new Date(Date.UTC(year, 0, 1)).getUTCDay() + 7) % 7);
  const rows = [
    ['Date', 'Holiday name', 'Type', 'Optional', 'Description'],
    [`${year}-01-26`, 'Republic Day', 'National', 'No', 'Office closed'],
    [`${year}-08-15`, 'Independence Day', 'National', 'No', ''],
    [`${year}-01-${String(firstSaturday + 7).padStart(2, '0')}`, 'Second Saturday', 'Weekly off', 'No', 'Only if your company gives it'],
  ];
  const sheet = utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 12 }, { wch: 10 }, { wch: 32 }];
  const book = utils.book_new();
  utils.book_append_sheet(book, sheet, 'Holidays');
  writeFile(book, 'holiday-import-template.xlsx');
}
