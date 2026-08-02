import { z } from 'zod';
import { RecordStatuses } from '../constants';

export const createDoctorSchema = z.object({
  fullName: z.string().min(2).max(150),
  specialization: z.string().max(120).optional(),
  hospital: z.string().max(150).optional(),
  clinic: z.string().max(150).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  visitingDays: z.string().max(120).optional(),
  preferredTime: z.string().max(80).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).optional(),
  mrId: z.string().uuid().optional(),
});

export const updateDoctorSchema = createDoctorSchema.partial();

export const listDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export const assignMrSchema = z.object({
  mrId: z.string().uuid(),
});

export type CreateDoctorDto = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorDto = z.infer<typeof updateDoctorSchema>;
export type ListDoctorsQueryDto = z.infer<typeof listDoctorsQuerySchema>;
export type AssignMrDto = z.infer<typeof assignMrSchema>;
