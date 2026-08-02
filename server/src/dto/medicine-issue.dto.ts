import { z } from 'zod';
import { idSchema } from './common.dto';

export const createMedicineIssueSchema = z.object({
  mrId: idSchema,
  medicineId: idSchema,
  quantity: z.coerce.number().int().positive(),
  batchNumber: z.string().max(60).optional(),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  remarks: z.string().max(1000).optional(),
});

export const listMedicineIssuesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  mrId: idSchema.optional(),
  medicineId: idSchema.optional(),
});

export type CreateMedicineIssueDto = z.infer<typeof createMedicineIssueSchema>;
export type ListMedicineIssuesQueryDto = z.infer<typeof listMedicineIssuesQuerySchema>;
