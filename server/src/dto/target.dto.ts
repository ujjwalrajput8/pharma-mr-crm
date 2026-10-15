import { z } from 'zod';
import { idSchema } from './common.dto';

/** Calendar month a target belongs to, e.g. "2026-10". */
const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

export const upsertTargetSchema = z.object({
  userId: idSchema,
  targetMonth: monthSchema,
  /** Omit / null for the MR's overall monthly target. */
  medicineId: idSchema.nullable().optional(),
  targetAmount: z.coerce.number().nonnegative(),
  targetUnits: z.coerce.number().int().nonnegative().nullable().optional(),
});

export const listTargetsQuerySchema = z.object({
  month: monthSchema.optional(),
  userId: idSchema.optional(),
});

export const targetProgressQuerySchema = z.object({
  month: monthSchema.optional(),
  userId: idSchema.optional(),
});

export type UpsertTargetDto = z.infer<typeof upsertTargetSchema>;
export type ListTargetsQueryDto = z.infer<typeof listTargetsQuerySchema>;
export type TargetProgressQueryDto = z.infer<typeof targetProgressQuerySchema>;
