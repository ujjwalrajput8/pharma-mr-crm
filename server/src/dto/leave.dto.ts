import { z } from 'zod';
import { LeaveDayParts, LeaveStatuses, RecordStatuses } from '../constants';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

/** ── Leave requests ───────────────────────────────────────────────────────── */

export const applyLeaveSchema = z
  .object({
    leaveTypeId: idSchema,
    fromDate: dateOnly,
    toDate: dateOnly,
    dayPart: z
      .enum([LeaveDayParts.FULL, LeaveDayParts.FIRST_HALF, LeaveDayParts.SECOND_HALF])
      .default(LeaveDayParts.FULL),
    reason: z.string().min(3, 'Tell your manager why').max(1000),
    contactPhone: z.string().min(7).max(20).optional(),
    attachmentUrl: z.string().url().max(500).optional(),
    /** Admin / Manager may file on behalf of a team member. */
    userId: idSchema.optional(),
  })
  .refine((value) => value.fromDate <= value.toDate, {
    message: 'From date cannot be after to date',
    path: ['toDate'],
  })
  .refine(
    (value) => value.dayPart === LeaveDayParts.FULL || value.fromDate === value.toDate,
    { message: 'Half-day applies to a single date only', path: ['dayPart'] },
  );

export const listLeavesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  userId: idSchema.optional(),
  leaveTypeId: idSchema.optional(),
  status: z
    .enum([
      LeaveStatuses.PENDING,
      LeaveStatuses.APPROVED,
      LeaveStatuses.REJECTED,
      LeaveStatuses.CANCELLED,
    ])
    .optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const decideLeaveSchema = z.object({
  status: z.enum([LeaveStatuses.APPROVED, LeaveStatuses.REJECTED]),
  decisionRemark: z.string().max(1000).optional(),
});

export const cancelLeaveSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** ── Leave types (policy master) ──────────────────────────────────────────── */

export const upsertLeaveTypeSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[A-Z0-9_]+$/, 'Use upper-case letters, digits or underscore (e.g. CL, SL, COMP_OFF)'),
  name: z.string().min(2).max(80),
  annualQuota: z.coerce.number().min(0).max(365).default(0),
  isPaid: z.coerce.boolean().default(true),
  carryForward: z.coerce.boolean().default(false),
  maxCarryForward: z.coerce.number().min(0).max(365).default(0),
  allowHalfDay: z.coerce.boolean().default(true),
  requiresProof: z.coerce.boolean().default(false),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Expected a hex colour like #0f766e')
    .default('#0f766e'),
  description: z.string().max(500).optional(),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).default(RecordStatuses.ACTIVE),
});

export const updateLeaveTypeSchema = upsertLeaveTypeSchema.partial();

/** ── Balances ─────────────────────────────────────────────────────────────── */

export const leaveBalanceQuerySchema = z.object({
  userId: idSchema.optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const setLeaveBalanceSchema = z.object({
  userId: idSchema,
  leaveTypeId: idSchema,
  year: z.coerce.number().int().min(2000).max(2100),
  opening: z.coerce.number().min(0).max(365).default(0),
  allocated: z.coerce.number().min(0).max(365),
});

export type ApplyLeaveDto = z.infer<typeof applyLeaveSchema>;
export type ListLeavesQueryDto = z.infer<typeof listLeavesQuerySchema>;
export type DecideLeaveDto = z.infer<typeof decideLeaveSchema>;
export type CancelLeaveDto = z.infer<typeof cancelLeaveSchema>;
export type UpsertLeaveTypeDto = z.infer<typeof upsertLeaveTypeSchema>;
export type UpdateLeaveTypeDto = z.infer<typeof updateLeaveTypeSchema>;
export type LeaveBalanceQueryDto = z.infer<typeof leaveBalanceQuerySchema>;
export type SetLeaveBalanceDto = z.infer<typeof setLeaveBalanceSchema>;
