import { z } from 'zod';
import { idSchema } from './common.dto';

export const listDistributionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  medicineId: idSchema.optional(),
  visitId: idSchema.optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type ListDistributionsQueryDto = z.infer<typeof listDistributionsQuerySchema>;
