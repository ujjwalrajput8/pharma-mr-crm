import { z } from 'zod';
import { dateOnlySchema, idSchema, optionalDateOnlySchema } from './common.dto';

/** Why the MR met the doctor. "OTHER" needs a remark saying what it was. */
export const VISIT_PURPOSES = [
  'DETAILING',
  'FOLLOW_UP',
  'SAMPLE_DROP',
  'ORDER_POB',
  'RELATIONSHIP',
  'OTHER',
] as const;
/** Bulk is a UI action, not a source — every bulk row is its own DIRECT visit. */
export const VISIT_SOURCES = ['APPOINTMENT', 'DIRECT'] as const;
export const INTEREST_LEVELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

/** A real clock time — "24:00" and "99:99" are refused. */
export const clockSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be HH:MM between 00:00 and 23:59');

const booleanQuery = z.preprocess((value) => {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return value === 'true';
}, z.boolean().optional());

export const visitProductSchema = z.object({
  medicineId: idSchema,
  interestLevel: z.enum(INTEREST_LEVELS).optional(),
  prescriptionExpected: z.boolean().optional(),
  notes: z.string().max(500).optional(),
});

export const visitSampleSchema = z.object({
  medicineId: idSchema,
  quantity: z.coerce.number().int().positive().max(10_000),
  /** Pin one batch; otherwise the bag is used earliest-expiry first. */
  batchId: idSchema.optional(),
  batchNumber: z.string().max(60).optional(),
  remarks: z.string().max(500).optional(),
});

/** Fields every visit form sends — direct, from an appointment, or a correction. */
const visitFields = {
  visitDate: dateOnlySchema,
  visitTime: clockSchema,
  checkInTime: clockSchema.optional(),
  checkOutTime: clockSchema.optional(),
  purpose: z.enum(VISIT_PURPOSES).optional(),
  discussionNotes: z.string().max(5000).optional(),
  doctorFeedback: z.string().max(5000).optional(),
  visitOutcome: z.string().max(100).optional(),
  nextFollowUp: optionalDateOnlySchema,
  remarks: z.string().max(5000).optional(),
  products: z.array(visitProductSchema).max(30).optional(),
  medicineIds: z.array(idSchema).max(30).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  /** Set once per form; a retry with the same value returns the same visit. */
  clientUuid: z.string().uuid().optional(),
};

type VisitRuleInput = {
  visitDate?: string;
  checkInTime?: string;
  checkOutTime?: string;
  nextFollowUp?: string | null;
  purpose?: string | null;
  remarks?: string | null;
};

/** Cross-field rules shared by every visit form. */
export function visitRules(value: VisitRuleInput, ctx: z.RefinementCtx): void {
  if (value.checkInTime && value.checkOutTime && value.checkOutTime < value.checkInTime) {
    ctx.addIssue({ code: 'custom', path: ['checkOutTime'], message: 'Check-out cannot be before check-in' });
  }
  if (value.nextFollowUp && value.visitDate && value.nextFollowUp < value.visitDate) {
    ctx.addIssue({ code: 'custom', path: ['nextFollowUp'], message: 'Follow-up cannot be before the visit' });
  }
  if (value.purpose === 'OTHER' && (value.remarks ?? '').trim().length < 3) {
    ctx.addIssue({ code: 'custom', path: ['remarks'], message: 'Say what the visit was for (purpose "Other")' });
  }
}

/** POST /visits — log a visit straight away, no appointment needed. */
export const createVisitSchema = z
  .object({
    doctorId: idSchema,
    /** Manager / Admin logging for a team MR. */
    mrId: idSchema.optional(),
    ...visitFields,
    samples: z.array(visitSampleSchema).max(30).default([]),
  })
  .superRefine(visitRules);

/** POST /visits/bulk — one common entry for many doctors. No samples in bulk. */
export const bulkVisitSchema = z
  .object({
    doctorIds: z.array(idSchema).min(1).max(50, 'At most 50 doctors in one go'),
    mrId: idSchema.optional(),
    visitDate: dateOnlySchema,
    visitTime: clockSchema,
    purpose: z.enum(VISIT_PURPOSES).optional(),
    discussionNotes: z.string().max(5000).optional(),
    remarks: z.string().max(5000).optional(),
    products: z.array(visitProductSchema).max(30).optional(),
    dryRun: z.boolean().default(true),
  })
  .strict()
  .superRefine(visitRules);

/** PATCH /visits/:id — correction. The reason is kept in the history. */
export const correctVisitSchema = z
  .object({
    reason: z.string().trim().min(5, 'Say why the visit is being corrected (at least 5 characters)').max(500),
    visitDate: dateOnlySchema.optional(),
    doctorId: idSchema.optional(),
    visitTime: clockSchema.optional(),
    checkInTime: clockSchema.nullable().optional(),
    checkOutTime: clockSchema.nullable().optional(),
    purpose: z.enum(VISIT_PURPOSES).nullable().optional(),
    discussionNotes: z.string().max(5000).nullable().optional(),
    doctorFeedback: z.string().max(5000).nullable().optional(),
    visitOutcome: z.string().max(100).nullable().optional(),
    nextFollowUp: dateOnlySchema.nullable().optional(),
    remarks: z.string().max(5000).nullable().optional(),
    products: z.array(visitProductSchema).max(30).optional(),
  })
  .superRefine((value, ctx) =>
    visitRules(
      {
        ...value,
        checkInTime: value.checkInTime ?? undefined,
        checkOutTime: value.checkOutTime ?? undefined,
      },
      ctx,
    ),
  );

/** POST /visits/:id/sample-correction — Manager / Admin only. */
export const sampleCorrectionSchema = z.object({
  reason: z.string().trim().min(5, 'Say why the samples are being corrected (at least 5 characters)').max(500),
  lines: z
    .array(
      z.object({
        action: z.enum(['RETURN_TO_BAG', 'WRITE_OFF', 'ADD_GIVEN']),
        medicineId: idSchema,
        batchId: idSchema.optional(),
        quantity: z.coerce.number().int().positive().max(10_000),
      }),
    )
    .min(1)
    .max(30),
});

/** POST /visits/:id/review — an unlisted visit, looked at by the manager. */
export const reviewVisitSchema = z.object({
  action: z.enum(['ASSIGN', 'REVIEWED']),
  note: z.string().trim().max(500).optional(),
  /** Required when the doctor currently belongs to another MR. */
  confirmMove: z.boolean().optional(),
});

export const listVisitsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  doctorId: idSchema.optional(),
  mrId: idSchema.optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
  source: z.enum(VISIT_SOURCES).optional(),
  offList: booleanQuery,
  /** With offList: false = still waiting for the manager. */
  reviewed: booleanQuery,
  corrected: booleanQuery,
  search: z.string().trim().max(120).optional(),
});

export const lookupDoctorsQuerySchema = z.object({
  q: z.string().trim().min(2, 'Type at least 2 letters').max(80),
  limit: z.coerce.number().int().positive().max(20).default(20),
});

export type CreateVisitDto = z.infer<typeof createVisitSchema>;
export type BulkVisitDto = z.infer<typeof bulkVisitSchema>;
export type CorrectVisitDto = z.infer<typeof correctVisitSchema>;
export type SampleCorrectionDto = z.infer<typeof sampleCorrectionSchema>;
export type ReviewVisitDto = z.infer<typeof reviewVisitSchema>;
export type ListVisitsQueryDto = z.infer<typeof listVisitsQuerySchema>;
export type LookupDoctorsQueryDto = z.infer<typeof lookupDoctorsQuerySchema>;
export type VisitProductInput = z.infer<typeof visitProductSchema>;
export type VisitSampleInput = z.infer<typeof visitSampleSchema>;
