import { z } from 'zod';
import { idSchema } from './common.dto';

export const listAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  entity: z.string().max(80).optional(),
  action: z.string().max(80).optional(),
  userId: idSchema.optional(),
});

export type ListAuditLogsQueryDto = z.infer<typeof listAuditLogsQuerySchema>;
