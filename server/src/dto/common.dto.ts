import { z } from 'zod';

/** SQL autoincrement primary/foreign key (positive integer). */
export const idSchema = z.coerce.number().int().positive();

export const optionalIdSchema = idSchema.optional();

/** A real calendar day as `YYYY-MM-DD` — rejects free text and days like 2026-02-31. */
export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Not a valid date');

/** Optional day; an empty string from a cleared date field counts as "not given". */
export const optionalDateOnlySchema = z.preprocess(
  (value) => (value === '' ? undefined : value),
  dateOnlySchema.optional(),
);
