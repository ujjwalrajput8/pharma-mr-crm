import { z } from 'zod';
import { idSchema } from './common.dto';

export const reportTypes = [
  'daily',
  'weekly',
  'monthly',
  'mr-performance',
  'mr-detail',
  'doctor-visits',
  'appointments',
  'distributions',
  'stock',
  'sales',
] as const;

export const reportQuerySchema = z.object({
  type: z.enum(reportTypes),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mrId: idSchema.optional(),
  doctorId: idSchema.optional(),
  medicineId: idSchema.optional(),
  medicalStoreId: idSchema.optional(),
  status: z.string().optional(),
});

export type ReportQueryDto = z.infer<typeof reportQuerySchema>;
