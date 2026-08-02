import { z } from 'zod';

/** SQL autoincrement primary/foreign key (positive integer). */
export const idSchema = z.coerce.number().int().positive();

export const optionalIdSchema = idSchema.optional();
