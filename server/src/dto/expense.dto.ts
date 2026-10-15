import { z } from 'zod';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const EXPENSE_CATEGORIES = [
  'TRAVEL',
  'DAILY_ALLOWANCE',
  'HOTEL',
  'FOOD',
  'PHONE',
  'STATIONERY',
  'OTHER',
] as const;

export const EXPENSE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED'] as const;

const fileKeySchema = z
  .string()
  .regex(/^[0-9a-f]{32}(\.[a-z0-9]{1,10})?$/i, 'Invalid file key');

export const createExpenseSchema = z.object({
  expenseDate: dateOnly,
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.coerce.number().positive('Amount must be more than 0').max(10_000_000),
  /** Kilometres for TRAVEL claims — feeds per-km settlement later. */
  distanceKm: z.coerce.number().min(0).max(100000).optional(),
  description: z.string().min(3, 'Say what this was spent on').max(500),
  /** Key returned by POST /files (purpose `expense-receipt`). */
  receiptFileKey: fileKeySchema.optional(),
});

export const updateExpenseSchema = createExpenseSchema.partial();

export const listExpensesQuerySchema = z.object({
  /** YYYY-MM month key or any date inside the month. */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Expected YYYY-MM or YYYY-MM-DD')
    .optional(),
  status: z.enum(EXPENSE_STATUSES).optional(),
  userId: idSchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(100),
});

export const decideExpenseSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  remark: z.string().max(500).optional(),
});

export const expenseSummaryQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}(-\d{2})?$/, 'Expected YYYY-MM or YYYY-MM-DD')
    .optional(),
});

export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];
export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;
export type ListExpensesQueryDto = z.infer<typeof listExpensesQuerySchema>;
export type DecideExpenseDto = z.infer<typeof decideExpenseSchema>;
export type ExpenseSummaryQueryDto = z.infer<typeof expenseSummaryQuerySchema>;
