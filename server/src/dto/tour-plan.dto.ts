import { z } from 'zod';
import { WorkTypes } from '../constants';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Expected YYYY-MM');

export const TOUR_PLAN_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'LOCKED',
] as const;
export type TourPlanStatusValue = (typeof TOUR_PLAN_STATUSES)[number];

export const tourPlanMonthQuerySchema = z.object({
  month: monthKey,
});

/** One planned call — exactly one of doctor / chemist. */
const planCallSchema = z
  .object({
    doctorId: idSchema.optional(),
    chemistId: idSchema.optional(),
  })
  .refine((value) => Boolean(value.doctorId) !== Boolean(value.chemistId), {
    message: 'A call is either a doctor or a chemist — pick one',
  });

const planDaySchema = z.object({
  planDate: dateOnly,
  territoryId: idSchema.optional(),
  workType: z.enum([
    WorkTypes.FIELD,
    WorkTypes.OFFICE,
    WorkTypes.JOINT_WORK,
    WorkTypes.LEAVE,
    WorkTypes.HOLIDAY,
  ]),
  jointWithUserId: idSchema.optional(),
  notes: z.string().trim().max(500).optional(),
  calls: z.array(planCallSchema).max(60).default([]),
});

/** PUT /tour-plans/my — the whole month draft, replace-all. */
export const upsertMyTourPlanSchema = z.object({
  days: z.array(planDaySchema).max(31),
});

export const listTourPlansQuerySchema = z.object({
  month: monthKey.optional(),
  status: z.enum(TOUR_PLAN_STATUSES).optional(),
  userId: idSchema.optional(),
});

export const decideTourPlanSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remark: z.string().trim().max(1000).optional(),
});

export type TourPlanMonthQueryDto = z.infer<typeof tourPlanMonthQuerySchema>;
export type UpsertMyTourPlanDto = z.infer<typeof upsertMyTourPlanSchema>;
export type TourPlanCallDto = z.infer<typeof planCallSchema>;
export type TourPlanDayDto = z.infer<typeof planDaySchema>;
export type ListTourPlansQueryDto = z.infer<typeof listTourPlansQuerySchema>;
export type DecideTourPlanDto = z.infer<typeof decideTourPlanSchema>;
