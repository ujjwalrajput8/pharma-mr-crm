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

export type ListEmployeesQueryDto = z.infer<typeof listEmployeesQuerySchema>;
export type EmployeeProfileQueryDto = z.infer<typeof employeeProfileQuerySchema>;
export type UpdateEmployeeProfileDto = z.infer<typeof updateEmployeeProfileSchema>;
