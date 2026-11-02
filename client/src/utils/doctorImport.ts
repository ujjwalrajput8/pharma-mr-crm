import { parseSpreadsheet, type ParsedSheet } from '@/utils/spreadsheetImport';

/**
 * Canonical import columns — the keys the API's doctor import endpoint reads.
 * No MSL No: the system assigns it, so a sheet's MYMSL NO column is ignored.
 */
export const DOCTOR_IMPORT_FIELDS = [
  'area',
  'areaType',
  'fullName',
  'phone',
  'mslClass',
  'specialization',
  'address',
  'email',
  'birthday',
  'anniversary',
] as const;

export type DoctorImportField = (typeof DOCTOR_IMPORT_FIELDS)[number];

/** Header spellings seen in MSL sheets ("DOCTOR'S NAME" → "doctorsname"). */
const HEADER_ALIASES: Record<DoctorImportField, string[]> = {
  area: ['areahqex', 'areahqexos', 'area', 'areaname', 'patch', 'town', 'city', 'place', 'locality'],
  areaType: ['hqex', 'hqexos', 'station', 'stationtype', 'areatype'],
  fullName: ['doctorsname', 'doctorname', 'drname', 'drsname', 'name', 'doctor', 'fullname', 'nameofdoctor'],
  phone: ['mobileno', 'mobile', 'mobilenumber', 'mob', 'mobno', 'phone', 'phoneno', 'contact', 'contactno', 'cellno'],
  mslClass: ['mslclass', 'class', 'doctorclass', 'drclass', 'category', 'mslcategory'],
  specialization: ['speciality', 'specialty', 'specialization', 'specialisation', 'spec'],
  address: ['address', 'clinicaddress', 'addr', 'fulladdress'],
  email: ['emailid', 'email', 'emailaddress', 'mail', 'mailid'],
  birthday: ['birthday', 'dob', 'dateofbirth', 'birthdate', 'bday'],
  anniversary: [
    'anniversary',
    'anniversarydate',
    'weddinganniversary',
    'marriageanniversary',
    'doa',
    'anivarsary',
    'aniversary',
    'anniversery',
  ],
};

const DATE_FIELDS: ReadonlySet<DoctorImportField> = new Set(['birthday', 'anniversary']);

export type ParsedDoctorFile = ParsedSheet<DoctorImportField>;

export function parseDoctorFile(file: File): Promise<ParsedDoctorFile> {
  return parseSpreadsheet(file, {
    aliases: HEADER_ALIASES,
    dateFields: DATE_FIELDS,
    isHeader: (fields) => fields.includes('fullName'),
    headerHint:
      'Could not find the header row. The first row should name the columns — at least "DOCTOR\'S NAME".',
  });
}
