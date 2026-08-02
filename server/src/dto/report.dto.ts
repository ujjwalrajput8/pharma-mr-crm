import { z } from 'zod';

export const reportTypes = [
  'daily',
  'weekly',
  'monthly',
  'mr-performance',
  'doctor-visits',
  'appointments',
  'distributions',
  'stock',
] as const;

export const reportQuerySchema = z.object({
  type: z.enum(reportTypes),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mrId: z.string().uuid().optional(),
});

export type ReportQueryDto = z.infer<typeof reportQuerySchema>;
