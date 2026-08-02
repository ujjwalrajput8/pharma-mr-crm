import { z } from 'zod';
import { idSchema } from './common.dto';

export const createSaleSchema = z.object({
  doctorId: idSchema.optional(),
  medicalStoreId: idSchema.optional(),
  medicineId: idSchema,
  mrId: idSchema.optional(),
  quantity: z.coerce.number().int().positive(),
  amount: z.coerce.number().nonnegative(),
  invoiceDate: z.string().min(1),
  invoiceNumber: z.string().max(80).optional(),
  remarks: z.string().max(1000).optional(),
});

export const listSalesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  mrId: idSchema.optional(),
  medicineId: idSchema.optional(),
  doctorId: idSchema.optional(),
  medicalStoreId: idSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateSaleDto = z.infer<typeof createSaleSchema>;
export type ListSalesQueryDto = z.infer<typeof listSalesQuerySchema>;
