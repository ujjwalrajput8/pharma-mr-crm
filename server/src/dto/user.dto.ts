import { z } from 'zod';
import { AppRoles, UserStatuses } from '../constants';

export const createMrSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2).max(120),
  phone: z.string().min(7).max(20).optional(),
  employeeCode: z.string().min(2).max(40),
  address: z.string().max(500).optional(),
  joiningDate: z.string().optional(),
  assignedArea: z.string().max(120).optional(),
});

export const updateMrSchema = z.object({
  email: z.string().email().optional(),
  fullName: z.string().min(2).max(120).optional(),
  phone: z.string().min(7).max(20).nullable().optional(),
  status: z.enum([UserStatuses.ACTIVE, UserStatuses.INACTIVE]).optional(),
  employeeCode: z.string().min(2).max(40).optional(),
  address: z.string().max(500).nullable().optional(),
  joiningDate: z.string().nullable().optional(),
  assignedArea: z.string().max(120).nullable().optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum([UserStatuses.ACTIVE, UserStatuses.INACTIVE]).optional(),
  role: z.enum([AppRoles.ADMIN, AppRoles.MR]).optional(),
});

export type CreateMrDto = z.infer<typeof createMrSchema>;
export type UpdateMrDto = z.infer<typeof updateMrSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>;
