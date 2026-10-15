import { z } from 'zod';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const INVOICE_STATUSES = ['UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'] as const;
export const PAYMENT_MODES = [
  'CASH',
  'UPI',
  'CHEQUE',
  'BANK_TRANSFER',
  'CREDIT_NOTE',
  'OTHER',
] as const;

export const invoiceLineSchema = z.object({
  medicineId: idSchema,
  quantity: z.coerce.number().int().positive(),
  /** Unit price on the bill line. */
  rate: z.coerce.number().nonnegative(),
  discountPct: z.coerce.number().min(0).max(100).optional(),
});

export const createInvoiceSchema = z
  .object({
    doctorId: idSchema.optional(),
    medicalStoreId: idSchema.optional(),
    /** Defaults to the actor when they are an MR; managers/admins may bill for their team. */
    mrId: idSchema.optional(),
    invoiceDate: dateOnly,
    dueDate: dateOnly.optional(),
    remarks: z.string().max(1000).optional(),
    lines: z.array(invoiceLineSchema).min(1, 'Add at least one line'),
  })
  .refine((value) => Boolean(value.doctorId) !== Boolean(value.medicalStoreId), {
    message: 'Bill exactly one party — either a doctor or a medical store',
    path: ['doctorId'],
  });

export const listInvoicesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(50),
  doctorId: idSchema.optional(),
  medicalStoreId: idSchema.optional(),
  mrId: idSchema.optional(),
  status: z.enum(INVOICE_STATUSES).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  /** Matches invoice number, doctor name or store name. */
  search: z.string().max(120).optional(),
});

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Payment must be greater than zero'),
  paymentDate: dateOnly,
  mode: z.enum(PAYMENT_MODES),
  reference: z.string().max(120).optional(),
  remarks: z.string().max(1000).optional(),
});

export const invoiceSummaryQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  groupBy: z.enum(['doctor', 'store', 'mr']).default('doctor'),
});

export type InvoiceLineDto = z.infer<typeof invoiceLineSchema>;
export type CreateInvoiceDto = z.infer<typeof createInvoiceSchema>;
export type ListInvoicesQueryDto = z.infer<typeof listInvoicesQuerySchema>;
export type RecordPaymentDto = z.infer<typeof recordPaymentSchema>;
export type InvoiceSummaryQueryDto = z.infer<typeof invoiceSummaryQuerySchema>;
