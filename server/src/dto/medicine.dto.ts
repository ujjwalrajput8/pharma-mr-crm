import { z } from 'zod';
import { RecordStatuses } from '../constants';

export const createMedicineSchema = z.object({
  name: z.string().min(2).max(150),
  brandName: z.string().max(150).optional(),
  genericName: z.string().max(150).optional(),
  company: z.string().max(150).optional(),
  composition: z.string().max(500).optional(),
  strength: z.string().max(80).optional(),
  category: z.string().max(100).optional(),
  packSize: z.string().max(50).optional(),
  mrp: z.coerce.number().nonnegative(),
  sku: z.string().max(50).optional(),
  batchNumber: z.string().max(60).optional(),
  expiryDate: z.string().optional(),
  description: z.string().max(2000).optional(),
  sampleAvailable: z.boolean().optional(),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).optional(),
  openingStock: z.coerce.number().int().nonnegative().default(0),
  minimumStockAlert: z.coerce.number().int().nonnegative().default(10),
});

export const updateMedicineSchema = createMedicineSchema
  .omit({ openingStock: true })
  .partial();

export const listMedicinesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // The catalog screen and every product picker load the whole list client-side.
  limit: z.coerce.number().int().positive().max(2000).default(20),
  search: z.string().optional(),
  category: z.string().optional(),
});

export const MEDICINE_IMPORT_MAX_ROWS = 2000;

/**
 * Bulk upsert of the catalog. A row's quantity is always *received* into the
 * default warehouse on top of what is left (30 left + 100 new = 130) — the
 * ledger is append-only, so an import never overwrites a stock figure.
 */
export const importMedicinesSchema = z.object({
  /** Defaults to a preview so a bare call can never write. */
  dryRun: z.boolean().default(true),
  /** Uploaded spreadsheet name — stamped on the GRN (stock receipt). */
  fileName: z.string().max(255).optional(),
  /** Supplier / plant the goods came from. */
  source: z.string().max(150).optional(),
  /** Supplier invoice / challan number. */
  invoiceNo: z.string().max(80).optional(),
  /** Goods receipt date; defaults to today. */
  receiptDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
    .optional(),
  rows: z
    .array(
      z.object({
        /** Spreadsheet row number, echoed back so errors point at the right line. */
        rowNumber: z.number().int().positive(),
        values: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1, 'The file has no data rows')
    .max(MEDICINE_IMPORT_MAX_ROWS, `Import at most ${MEDICINE_IMPORT_MAX_ROWS} rows at a time`),
});

export type CreateMedicineDto = z.infer<typeof createMedicineSchema>;
export type UpdateMedicineDto = z.infer<typeof updateMedicineSchema>;
export type ListMedicinesQueryDto = z.infer<typeof listMedicinesQuerySchema>;
export type ImportMedicinesDto = z.infer<typeof importMedicinesSchema>;
