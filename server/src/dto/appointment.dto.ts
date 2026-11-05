import { z } from 'zod';
import { dateOnlySchema, idSchema, optionalDateOnlySchema } from './common.dto';
import { AppointmentStatuses } from '../constants';
import { VISIT_PURPOSES, clockSchema, visitProductSchema, visitRules } from './visit.dto';

export const createAppointmentSchema = z.object({
  doctorId: idSchema,
  mrId: idSchema.optional(),
  date: dateOnlySchema,
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  purpose: z.string().max(500).optional(),
  remarks: z.string().max(2000).optional(),
  status: z
    .enum([
      AppointmentStatuses.PENDING,
      AppointmentStatuses.COMPLETED,
      AppointmentStatuses.CANCELLED,
      AppointmentStatuses.RESCHEDULED,
    ])
    .optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

export const listAppointmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z
    .enum([
      AppointmentStatuses.PENDING,
      AppointmentStatuses.COMPLETED,
      AppointmentStatuses.CANCELLED,
      AppointmentStatuses.RESCHEDULED,
    ])
    .optional(),
  doctorId: idSchema.optional(),
  mrId: idSchema.optional(),
  /** Today · Upcoming · Overdue (date passed, still open) · Completed · Cancelled / No-show. */
  view: z.enum(['today', 'upcoming', 'overdue', 'completed', 'closed']).optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

/** POST /appointments/:id/no-show — the doctor was not available / did not meet. */
export const noShowAppointmentSchema = z.object({
  remark: z.string().trim().max(500).optional(),
});

/**
 * POST /appointments/:id/complete — same shape as before; the visit goes through the
 * shared visit rules (VisitService.record). `distributions` are the samples.
 */
export const completeAppointmentSchema = z
  .object({
    visitDate: dateOnlySchema,
    visitTime: clockSchema,
    checkInTime: clockSchema.optional(),
    checkOutTime: clockSchema.optional(),
    meetingDurationMin: z.coerce.number().int().positive().optional(),
    purpose: z.enum(VISIT_PURPOSES).optional(),
    discussionNotes: z.string().max(5000).optional(),
    doctorFeedback: z.string().max(5000).optional(),
    visitOutcome: z.string().max(100).optional(),
    nextFollowUp: optionalDateOnlySchema,
    remarks: z.string().max(5000).optional(),
    medicineIds: z.array(idSchema).default([]),
    products: z.array(visitProductSchema).max(30).optional(),
    distributions: z
      .array(
        z.object({
          medicineId: idSchema,
          quantity: z.coerce.number().int().positive().max(10_000),
          batchId: idSchema.optional(),
          batchNumber: z.string().max(60).optional(),
          unit: z.string().max(40).optional(),
          remarks: z.string().max(500).optional(),
        }),
      )
      .max(30)
      .default([]),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    clientUuid: z.string().uuid().optional(),
  })
  .superRefine(visitRules);

export const rescheduleAppointmentSchema = z.object({
  date: dateOnlySchema,
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  remarks: z.string().max(2000).optional(),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQueryDto = z.infer<typeof listAppointmentsQuerySchema>;
export type NoShowAppointmentDto = z.infer<typeof noShowAppointmentSchema>;
export type CompleteAppointmentDto = z.infer<typeof completeAppointmentSchema>;
export type RescheduleAppointmentDto = z.infer<typeof rescheduleAppointmentSchema>;
