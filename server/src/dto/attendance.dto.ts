import { z } from 'zod';
import { idSchema } from './common.dto';

export const checkInSchema = z.object({
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  locationNote: z.string().max(200).optional(),
  remarks: z.string().max(500).optional(),
});

export const checkOutSchema = z.object({
  remarks: z.string().max(500).optional(),
});

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(31),
  mrId: idSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CheckInDto = z.infer<typeof checkInSchema>;
export type CheckOutDto = z.infer<typeof checkOutSchema>;
export type ListAttendanceQueryDto = z.infer<typeof listAttendanceQuerySchema>;
