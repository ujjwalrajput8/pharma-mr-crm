import { z } from 'zod';

export const createVisitSchema = z.object({
  doctorId: z.string().uuid(),
  mrId: z.string().uuid().optional(),
  visitDate: z.string().min(1),
  remarks: z.string().max(2000).optional(),
  nextFollowUp: z.string().optional(),
  medicineIds: z.array(z.string().uuid()).default([]),
});

export const listVisitsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  doctorId: z.string().uuid().optional(),
});

export type CreateVisitDto = z.infer<typeof createVisitSchema>;
export type ListVisitsQueryDto = z.infer<typeof listVisitsQuerySchema>;
