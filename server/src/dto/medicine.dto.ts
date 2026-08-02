import { z } from 'zod';
import { RecordStatuses } from '../constants';

export const createMedicineSchema = z.object({
  name: z.string().min(2).max(150),
  brandName: z.string().max(150).optional(),
  genericName: z.string().max(150).optional(),
  company: z.string().max(150).optional(),
  composition: z.string().max(500).optional(),
  strength: z.string().max(80).optional(),
  category: z.string().max(100).optional(),
  packSize: z.string().max(50).optional(),
  mrp: z.coerce.number().nonnegative(),
  sku: z.string().max(50).optional(),
  batchNumber: z.string().max(60).optional(),
  expiryDate: z.string().optional(),
  description: z.string().max(2000).optional(),
  sampleAvailable: z.boolean().optional(),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).optional(),
  openingStock: z.coerce.number().int().nonnegative().default(0),
  minimumStockAlert: z.coerce.number().int().nonnegative().default(10),
});

export const updateMedicineSchema = createMedicineSchema
  .omit({ openingStock: true })
  .partial();

export const listMedicinesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
});

export type CreateMedicineDto = z.infer<typeof createMedicineSchema>;
export type UpdateMedicineDto = z.infer<typeof updateMedicineSchema>;
export type ListMedicinesQueryDto = z.infer<typeof listMedicinesQuerySchema>;
