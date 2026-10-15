import { z } from 'zod';
import { HolderTypes, StockTxnTypes } from '../constants';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

const txnTypeSchema = z.enum([
  StockTxnTypes.OPENING,
  StockTxnTypes.RECEIPT,
  StockTxnTypes.TRANSFER,
  StockTxnTypes.ISSUE,
  StockTxnTypes.SAMPLE_GIVEN,
  StockTxnTypes.GIFT_GIVEN,
  StockTxnTypes.SALE,
  StockTxnTypes.RETURN,
  StockTxnTypes.EXPIRY_WRITEOFF,
  StockTxnTypes.ADJUSTMENT,
  StockTxnTypes.LOST,
]);

const refTypeSchema = z.enum(['ISSUE', 'VISIT', 'RETURN', 'COUNT', 'SALE', 'MANUAL', 'RECEIPT']);

const holderTypeSchema = z.enum([
  HolderTypes.WAREHOUSE,
  HolderTypes.USER,
  HolderTypes.DOCTOR,
  HolderTypes.CHEMIST,
]);

/**
 * GET /ledger/txns — the explorer over the append-only stock ledger.
 * A holder filter matches either side of a movement (from OR to).
 */
export const listLedgerTxnsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(200).default(50),
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    medicineId: idSchema.optional(),
    batchId: idSchema.optional(),
    txnType: txnTypeSchema.optional(),
    refType: refTypeSchema.optional(),
    createdBy: idSchema.optional(),
    holderType: holderTypeSchema.optional(),
    holderId: idSchema.optional(),
    /** Matches txnNo, note or medicine name. */
    search: z.string().max(120).optional(),
  })
  .refine((value) => (value.holderType === undefined) === (value.holderId === undefined), {
    message: 'holderType and holderId must be given together',
    path: ['holderId'],
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'From date cannot be after to date',
    path: ['to'],
  });

export const listLedgerReceiptsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

/** GET /ledger/statement — warehouse reconciliation; defaults to the current month. */
export const ledgerStatementQuerySchema = z
  .object({
    from: dateOnly.optional(),
    to: dateOnly.optional(),
    medicineId: idSchema.optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: 'From date cannot be after to date',
    path: ['to'],
  });

export type ListLedgerTxnsQueryDto = z.infer<typeof listLedgerTxnsQuerySchema>;
export type ListLedgerReceiptsQueryDto = z.infer<typeof listLedgerReceiptsQuerySchema>;
export type LedgerStatementQueryDto = z.infer<typeof ledgerStatementQuerySchema>;
