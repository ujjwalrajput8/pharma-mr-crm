import { z } from 'zod';
import { AttendanceStatuses, WorkTypes } from '../constants';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const workTypeSchema = z.enum([
  WorkTypes.FIELD,
  WorkTypes.OFFICE,
  WorkTypes.JOINT_WORK,
  WorkTypes.LEAVE,
  WorkTypes.HOLIDAY,
]);

export const checkInSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  /** GPS accuracy radius in metres, straight from the browser/device. */
  accuracyM: z.coerce.number().min(0).max(100000).optional(),
  isMockLocation: z.coerce.boolean().default(false),
  /** Device clock at the moment of check-in — compared against server time. */
  deviceAt: z.string().datetime().optional(),
  workType: workTypeSchema.default(WorkTypes.FIELD),
  locationNote: z.string().max(200).optional(),
  remarks: z.string().max(500).optional(),
});

export const checkOutSchema = z.object({
  remarks: z.string().max(500).optional(),
});

export const listAttendanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(400).default(62),
  mrId: idSchema.optional(),
  userId: idSchema.optional(),
  status: z
    .enum([
      AttendanceStatuses.PRESENT,
      AttendanceStatuses.LATE,
      AttendanceStatuses.ABSENT,
      AttendanceStatuses.LEAVE,
      AttendanceStatuses.HOLIDAY,
      AttendanceStatuses.OFFICE,
      AttendanceStatuses.JOINT_WORK,
      AttendanceStatuses.FLAGGED,
    ])
    .optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const manageAttendanceSchema = z.object({
  userId: idSchema,
  attDate: dateOnly,
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
  workType: workTypeSchema.optional(),
  remarks: z.string().max(500).optional(),
});

/** Month grid for one employee: attendance + holidays + approved leave merged. */
export const attendanceCalendarQuerySchema = z.object({
  userId: idSchema.optional(),
  /** Any date inside the wanted month; defaults to the current month. */
  month: dateOnly.optional(),
});

export const attendanceSummaryQuerySchema = z.object({
  userId: idSchema.optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  month: dateOnly.optional(),
});

/**
 * Clears a flagged check-in after a manager has looked at it. Keeps the flag
 * text in remarks so the history survives, and stamps who reviewed it.
 */
export const reviewFlagSchema = z.object({
  /** ACCEPT keeps the day as-is; REJECT marks it absent. */
  outcome: z.enum(['ACCEPT', 'REJECT']).default('ACCEPT'),
  remarks: z.string().max(500).optional(),
});

export type ReviewFlagDto = z.infer<typeof reviewFlagSchema>;
export type CheckInDto = z.infer<typeof checkInSchema>;
export type CheckOutDto = z.infer<typeof checkOutSchema>;
export type ListAttendanceQueryDto = z.infer<typeof listAttendanceQuerySchema>;
export type ManageAttendanceDto = z.infer<typeof manageAttendanceSchema>;
export type AttendanceCalendarQueryDto = z.infer<typeof attendanceCalendarQuerySchema>;
export type AttendanceSummaryQueryDto = z.infer<typeof attendanceSummaryQuerySchema>;
