import { z } from 'zod';
import { idSchema } from './common.dto';

export const createVisitSchema = z.object({
  doctorId: idSchema,
  mrId: idSchema.optional(),
  visitDate: z.string().min(1),
  remarks: z.string().max(2000).optional(),
  nextFollowUp: z.string().optional(),
  medicineIds: z.array(idSchema).default([]),
});

export const listVisitsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  doctorId: idSchema.optional(),
});

export type CreateVisitDto = z.infer<typeof createVisitSchema>;
export type ListVisitsQueryDto = z.infer<typeof listVisitsQuerySchema>;
