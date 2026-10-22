import { z } from 'zod';
import { AppRoles, Genders, UserStatuses } from '../constants';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const nullableDate = dateOnly.nullable().optional();
const nullableText = (max: number) => z.string().max(max).nullable().optional();

export const listEmployeesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().max(120).optional(),
  role: z.enum([AppRoles.MANAGER, AppRoles.MR]).optional(),
  status: z.enum([UserStatuses.ACTIVE, UserStatuses.INACTIVE]).optional(),
  managerId: idSchema.optional(),
});

export const employeeProfileQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: dateOnly.optional(),
});

/** HR fields an Admin can maintain on an employee record. */
export const updateEmployeeProfileSchema = z.object({
  designation: nullableText(80),
  dob: nullableDate,
  anniversary: nullableDate,
  gender: z.enum([Genders.MALE, Genders.FEMALE, Genders.OTHER]).nullable().optional(),
  bloodGroup: nullableText(10),
  maritalStatus: nullableText(20),
  qualification: nullableText(120),
  emergencyName: nullableText(120),
  emergencyPhone: nullableText(20),
  photoUrl: nullableText(500),
  panNumber: nullableText(20),
  aadhaarNumber: nullableText(20),
  bankName: nullableText(120),
  bankAccountNo: nullableText(40),
  bankIfsc: nullableText(20),
  address: nullableText(500),
  assignedArea: nullableText(120),
  joiningDate: nullableDate,
  exitDate: nullableDate,
  exitReason: nullableText(500),
});

/** ── Employee documents (Aadhaar / PAN / letters) ─────────────────────────── */

export const EMPLOYEE_DOC_TYPES = [
  'AADHAAR',
  'PAN',
  'OFFER_LETTER',
  'DEGREE',
  'CERTIFICATE',
  'OTHER',
] as const;

const fileKeySchema = z
  .string()
  .regex(/^[0-9a-f]{32}(\.[a-z0-9]{1,10})?$/i, 'Invalid file key');

export const createEmployeeDocumentSchema = z.object({
  docType: z.enum(EMPLOYEE_DOC_TYPES),
  title: z.string().min(2).max(120),
  /** Key returned by POST /files (purpose `employee-doc`). */
  fileKey: fileKeySchema,
  note: z.string().max(300).optional(),
});

/** Avatar — sets MrProfile.photoUrl to `file:<key>`. */
export const setAvatarSchema = z.object({
  fileKey: fileKeySchema,
});

export type CreateEmployeeDocumentDto = z.infer<typeof createEmployeeDocumentSchema>;
export type SetAvatarDto = z.infer<typeof setAvatarSchema>;
export type ListEmployeesQueryDto = z.infer<typeof listEmployeesQuerySchema>;
export type EmployeeProfileQueryDto = z.infer<typeof employeeProfileQuerySchema>;
export type UpdateEmployeeProfileDto = z.infer<typeof updateEmployeeProfileSchema>;
