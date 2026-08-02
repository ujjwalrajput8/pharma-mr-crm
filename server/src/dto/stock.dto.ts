import { z } from 'zod';
import { idSchema } from './common.dto';

export const listStockQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  search: z.string().optional(),
  lowOnly: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      if (typeof value === 'boolean') return value;
      return value === 'true';
    }),
});

export const adjustStockSchema = z.object({
  medicineId: idSchema,
  /**
   * Positive increases available stock; negative decreases it.
   * Creates an ADJUSTMENT stock movement.
   */
  quantityDelta: z.coerce.number().int().refine((value) => value !== 0, {
    message: 'quantityDelta must be non-zero',
  }),
  remarks: z.string().max(500).optional(),
});

export type ListStockQueryDto = z.infer<typeof listStockQuerySchema>;
export type AdjustStockDto = z.infer<typeof adjustStockSchema>;
