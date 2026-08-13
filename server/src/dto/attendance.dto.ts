import { z } from 'zod';
import { AttendanceStatuses } from '../constants';
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
  limit: z.coerce.number().int().positive().max(100).default(62),
  mrId: idSchema.optional(),
  userId: idSchema.optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export const manageAttendanceSchema = z.object({
  userId: idSchema,
  attDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum([
    AttendanceStatuses.PRESENT,
    AttendanceStatuses.LATE,
    AttendanceStatuses.ABSENT,
    AttendanceStatuses.LEAVE,
    AttendanceStatuses.HOLIDAY,
    AttendanceStatuses.OFFICE,
    AttendanceStatuses.JOINT_WORK,
    AttendanceStatuses.FLAGGED,
  ]),
  remarks: z.string().max(500).optional(),
});

export type CheckInDto = z.infer<typeof checkInSchema>;
export type CheckOutDto = z.infer<typeof checkOutSchema>;
export type ListAttendanceQueryDto = z.infer<typeof listAttendanceQuerySchema>;
export type ManageAttendanceDto = z.infer<typeof manageAttendanceSchema>;
