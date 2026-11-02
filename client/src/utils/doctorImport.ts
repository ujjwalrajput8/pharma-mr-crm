import { utils, writeFile } from 'xlsx';
import { parseSpreadsheet, type ParsedSheet } from '@/utils/spreadsheetImport';

/** Canonical import columns — the keys the API's doctor import endpoint reads. */
export const DOCTOR_IMPORT_FIELDS = [
  'mslNo',
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

export const DOCTOR_IMPORT_FIELD_LABEL: Record<DoctorImportField | 'mr', string> = {
  mslNo: 'MSL No',
  area: 'Area',
  areaType: 'HQ/EX',
  fullName: "Doctor's Name",
  phone: 'Mobile No',
  mslClass: 'MSL Class',
  specialization: 'Speciality',
  address: 'Address',
  email: 'Email ID',
  birthday: 'Birthday',
  anniversary: 'Anniversary',
  mr: 'Assigned MR',
};

/** Header spellings seen in MSL sheets ("DOCTOR'S NAME" → "doctorsname"). */
const HEADER_ALIASES: Record<DoctorImportField, string[]> = {
  mslNo: ['mymslno', 'mslno', 'msl', 'mymsl', 'mslnumber', 'mslcode', 'doctorcode', 'drcode'],
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
    isHeader: (fields) => fields.includes('fullName') || fields.includes('mslNo'),
    headerHint:
      'Could not find the header row. The first row should name the columns — at least "DOCTOR\'S NAME" or "MYMSL NO".',
  });
}

/** Same columns, same spelling, as the company MSL sheet. */
const TEMPLATE_HEADERS: Array<[Exclude<DoctorImportField, 'areaType'>, string]> = [
  ['mslNo', 'MYMSL NO'],
  ['area', 'AREA-HQ/EX'],
  ['fullName', "DOCTOR'S NAME"],
  ['phone', 'MOBILE NO'],
  ['mslClass', 'MSLCLASS'],
  ['specialization', 'SPECIALITY'],
  ['address', 'ADDRESS'],
  ['email', 'EMAIL ID'],
  ['birthday', 'BIRTHDAY'],
  ['anniversary', 'ANNIVERSARY'],
];

export function downloadDoctorTemplate(): void {
  const row = (values: Partial<Record<DoctorImportField, string>>) =>
    TEMPLATE_HEADERS.map(([field]) => values[field] ?? '');
  const sheet = utils.aoa_to_sheet([
    TEMPLATE_HEADERS.map(([, header]) => header),
    row({
      mslNo: 'M001',
      area: 'BORING ROAD-HQ',
      fullName: 'Dr. Rajesh Sharma',
      phone: '9876543210',
      mslClass: 'A',
      specialization: 'Physician',
      address: 'Shop 4, Boring Road, Patna 800001',
      email: 'rajesh.sharma@example.com',
      birthday: '15/08/1975',
      anniversary: '22/02/2002',
    }),
    row({
      mslNo: 'M002',
      area: 'DANAPUR-EX',
      fullName: 'Dr. Anita Verma',
      phone: '9123456789',
      mslClass: 'B',
      specialization: 'Gynaecologist',
    }),
  ]);
  sheet['!cols'] = TEMPLATE_HEADERS.map(([field]) => ({ wch: field === 'address' ? 36 : 18 }));
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, sheet, 'Doctors');
  writeFile(workbook, 'doctor-import-template.xlsx');
}
