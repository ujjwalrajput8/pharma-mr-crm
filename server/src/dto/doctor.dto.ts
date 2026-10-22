import { z } from 'zod';
import { idSchema } from './common.dto';
import { RecordStatuses } from '../constants';

/** `null` clears the column on update; `undefined` leaves it alone. */
const optionalText = (max: number) => z.string().max(max).nullable().optional();
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .nullable()
  .optional();

export const createDoctorSchema = z.object({
  fullName: z.string().min(2).max(150),
  specialization: optionalText(120),
  hospital: optionalText(150),
  clinic: optionalText(150),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(7).max(20).nullable().optional(),
  addressLine1: optionalText(200),
  addressLine2: optionalText(200),
  city: optionalText(100),
  state: optionalText(100),
  pincode: optionalText(20),
  visitingDays: optionalText(120),
  preferredTime: optionalText(80),
  birthday: optionalDate,
  anniversary: optionalDate,
  notes: optionalText(2000),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).optional(),
  mrId: idSchema.optional(),
});

export const updateDoctorSchema = createDoctorSchema.partial();

export const listDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export const assignMrSchema = z.object({
  mrId: idSchema,
});

export type CreateDoctorDto = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorDto = z.infer<typeof updateDoctorSchema>;
export type ListDoctorsQueryDto = z.infer<typeof listDoctorsQuerySchema>;
export type AssignMrDto = z.infer<typeof assignMrSchema>;
