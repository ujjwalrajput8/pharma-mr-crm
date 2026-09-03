import { z } from 'zod';
import { AppRoles, UserStatuses } from '../constants';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** Creates an MR or a Manager (ASM/RSM) account with its employee profile. */
export const createMrSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(20).optional(),
  role: z.enum([AppRoles.MANAGER, AppRoles.MR]).default(AppRoles.MR),
  /** Reporting manager — an MR under an ASM, an ASM under an RSM. */
  managerId: idSchema.optional(),
  territoryId: idSchema.optional(),
  employeeCode: z.string().min(2).max(40),
  designation: z.string().max(80).optional(),
  address: z.string().max(500).optional(),
  joiningDate: dateOnly.optional(),
  assignedArea: z.string().max(120).optional(),
});

export const updateMrSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(7).max(20).nullable().optional(),
  status: z.enum([UserStatuses.ACTIVE, UserStatuses.INACTIVE]).optional(),
  role: z.enum([AppRoles.MANAGER, AppRoles.MR]).optional(),
  managerId: idSchema.nullable().optional(),
  territoryId: idSchema.nullable().optional(),
  employeeCode: z.string().min(2).max(40).optional(),
  designation: z.string().max(80).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  joiningDate: dateOnly.nullable().optional(),
  assignedArea: z.string().max(120).nullable().optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  search: z.string().optional(),
  status: z.enum([UserStatuses.ACTIVE, UserStatuses.INACTIVE]).optional(),
  /** Omit to list MRs and Managers together. */
  role: z.enum([AppRoles.ADMIN, AppRoles.MANAGER, AppRoles.MR]).optional(),
});

export type CreateMrDto = z.infer<typeof createMrSchema>;
export type UpdateMrDto = z.infer<typeof updateMrSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;
