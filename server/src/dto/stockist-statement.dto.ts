import { z } from 'zod';
import { idSchema } from './common.dto';

export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM');
const qty = z.coerce.number().int().min(0).max(10_000_000);

/** GET /stockist-statements?storeId&month — the statement, or a template to fill. */
export const getStatementQuerySchema = z.object({ storeId: idSchema, month: monthSchema });

/**
 * PUT /stockist-statements — save a month (draft or submit). Opening comes from last
 * month's closing when there is one; otherwise the MR types it (first month).
 * Correcting a submitted statement (Manager / Admin only) needs a reason.
 */
export const saveStatementSchema = z
  .object({
    storeId: idSchema,
    month: monthSchema,
    lines: z
      .array(
        z.object({
          medicineId: idSchema,
          opening: qty.optional(),
          receipt: qty.default(0),
          sales: qty.default(0),
          returns: qty.default(0),
        }),
      )
      .max(300),
    remarks: z.string().trim().max(1000).optional(),
    submit: z.boolean().default(false),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = value.lines.map((l) => l.medicineId);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['lines'], message: 'A product is listed twice' });
  });

/** GET /stockist-statements/summary — quarter or year, calculated from the months. */
export const statementSummaryQuerySchema = z
  .object({
    storeId: idSchema,
    period: z.enum(['quarter', 'year']),
    year: z.coerce.number().int().min(2020).max(2100),
    quarter: z.coerce.number().int().min(1).max(4).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.period === 'quarter' && !value.quarter) ctx.addIssue({ code: 'custom', path: ['quarter'], message: 'Choose the quarter' });
  });

/** GET /stockist-statements/overview?month — which stockists have their statement in. */
export const statementOverviewQuerySchema = z.object({ month: monthSchema });

export type SaveStatementDto = z.infer<typeof saveStatementSchema>;
export type StatementSummaryQueryDto = z.infer<typeof statementSummaryQuerySchema>;
