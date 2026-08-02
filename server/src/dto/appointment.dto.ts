import { z } from 'zod';
import { idSchema } from './common.dto';
import { AppointmentStatuses } from '../constants';

export const createAppointmentSchema = z.object({
  doctorId: idSchema,
  mrId: idSchema.optional(),
  date: z.string().min(1),
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
});

export const completeAppointmentSchema = z.object({
  visitDate: z.string().min(1),
  visitTime: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM'),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  meetingDurationMin: z.coerce.number().int().positive().optional(),
  discussionNotes: z.string().max(5000).optional(),
  doctorFeedback: z.string().max(5000).optional(),
  visitOutcome: z.string().max(100).optional(),
  nextFollowUp: z.string().optional(),
  remarks: z.string().max(5000).optional(),
  medicineIds: z.array(idSchema).default([]),
  products: z
    .array(
      z.object({
        medicineId: idSchema,
        notes: z.string().max(500).optional(),
      }),
    )
    .optional(),
  distributions: z
    .array(
      z.object({
        medicineId: idSchema,
        quantity: z.coerce.number().int().positive(),
        batchNumber: z.string().max(60).optional(),
        unit: z.string().max(40).optional(),
        remarks: z.string().max(500).optional(),
      }),
    )
    .default([]),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentDto = z.infer<typeof updateAppointmentSchema>;
export type ListAppointmentsQueryDto = z.infer<typeof listAppointmentsQuerySchema>;
export type CompleteAppointmentDto = z.infer<typeof completeAppointmentSchema>;
