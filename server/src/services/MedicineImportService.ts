import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';
import type { ImportMedicinesDto } from '../dto/medicine.dto';
import { HolderTypes, RecordStatuses, StockTxnTypes } from '../constants';
import { MedicineRepository } from '../repositories/MedicineRepository';
import { StockTxnRepository, type StockTxnClient } from '../repositories/StockTxnRepository';
import { StockLedgerService } from './StockLedgerService';
import { AuditService } from './AuditService';
import { parseDateOnly, toLocalDateString, todayDateOnly } from '../utils/datetime';

/** Medicine columns an import row may set. `name` + `mrp` are required to create. */
const TEXT_FIELDS = {
  name: 150,
  brandName: 150,
  genericName: 150,
  company: 150,
  composition: 500,
  strength: 80,
  category: 100,
  packSize: 50,
  sku: 50,
  code: 50,
  description: 2000,
} as const;
const MONEY_FIELDS = ['mrp', 'ptr', 'pts'] as const;

type TextField = keyof typeof TEXT_FIELDS;
type MoneyField = (typeof MONEY_FIELDS)[number];
type MedicineField = TextField | MoneyField | 'sampleAvailable' | 'status';
type FieldValue = string | number | boolean | null;
type MedicineFields = Partial<Record<MedicineField, FieldValue>>;

const MEDICINE_FIELDS: MedicineField[] = [
  ...(Object.keys(TEXT_FIELDS) as TextField[]),
  ...MONEY_FIELDS,
  'sampleAvailable',
  'status',
];

interface ParsedRow {
  fields: MedicineFields;
  batchNo?: string;
  expiryDate?: Date;
  mfgDate?: Date;
  quantity?: number;
}

interface BatchState {
  id: number | null;
  batchNo: string;
  expiryDate: Date | null;
  mfgDate: Date | null;
}

/** In-memory copy of one medicine, advanced row by row as the plan is built. */
interface MedicineState {
  id: number | null;
  isNew: boolean;
  fields: Record<MedicineField, FieldValue>;
  batches: BatchState[];
  /** Batch numbers of soft-deleted batches: the unique index still holds them. */
  deletedBatchNos: Set<string>;
  received: number;
  out: number;
  available: number;
}

type ImportOp =
  | { kind: 'createMedicine'; medicine: MedicineState; data: MedicineFields }
  | { kind: 'updateMedicine'; medicine: MedicineState; data: MedicineFields }
  | { kind: 'createBatch'; medicine: MedicineState; batch: BatchState }
  | { kind: 'updateBatch'; batch: BatchState; data: { expiryDate?: Date; mfgDate?: Date } }
  | { kind: 'stock'; medicine: MedicineState; batch: BatchState; qty: number; opening: boolean };

export interface ImportRowResult {
  rowNumber: number;
  action: 'create' | 'update' | 'unchanged' | 'error';
  medicineId: number | null;
  medicineName: string | null;
  matchedBy: 'sku' | 'code' | 'name' | null;
  changes: Array<{ field: string; from: FieldValue; to: FieldValue }>;
  stock: {
    batchNo: string;
    newBatch: boolean;
    /** Warehouse figures for the whole medicine before this row. */
    received: number;
    out: number;
    available: number;
    incoming: number;
    after: number;
  } | null;
  errors: string[];
}

interface Plan {
  rows: ImportRowResult[];
  ops: ImportOp[][];
  warehouseId: number | null;
}

const lower = (value: string) => value.trim().toLowerCase();
const nameKey = (name: string, strength: FieldValue) =>
  `${lower(name)}|${typeof strength === 'string' ? lower(strength) : ''}`;

function toText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

/** "₹1,234.50" → 1234.5. `null` when present but not a number. */
function toMoney(value: unknown): number | null | undefined {
  const text = toText(value);
  if (text === undefined) return undefined;
  const amount = Number(text.replace(/[₹,\s]|rs\.?/gi, ''));
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

function toBoolean(value: unknown): boolean | null | undefined {
  const text = toText(value);
  if (text === undefined) return undefined;
  const normalized = text.toLowerCase();
  if (['yes', 'y', 'true', '1', 'available'].includes(normalized)) return true;
  if (['no', 'n', 'false', '0', 'not available'].includes(normalized)) return false;
  return null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function utcDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date
    : null;
}

/** Last day of a month — pharma packs print expiry as "12/2027". */
const endOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0));

const fullYear = (year: number) => (year < 100 ? 2000 + year : year);

/**
 * Accepts 2027-12-31, 31/12/2027, 31-12-27, 12/2027, 2027-12, Dec-2027, Dec 27.
 * Day-first throughout: this is an Indian catalog.
 */
function toDate(value: unknown): Date | null | undefined {
  const text = toText(value);
  if (text === undefined) return undefined;
  let match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return utcDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
  if (match) return utcDate(fullYear(Number(match[3])), Number(match[2]), Number(match[1]));
  match = text.match(/^(\d{1,2})[/.-](\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    return month >= 1 && month <= 12 ? endOfMonth(Number(match[2]), month) : null;
  }
  match = text.match(/^(\d{4})[/.-](\d{1,2})$/);
  if (match) {
    const month = Number(match[2]);
    return month >= 1 && month <= 12 ? endOfMonth(Number(match[1]), month) : null;
  }
  match = text.match(/^([a-z]{3})[a-z]*[\s/.-]+(\d{2}|\d{4})$/i);
  if (match) {
    const month = MONTHS[(match[1] ?? '').toLowerCase()];
    return month ? endOfMonth(fullYear(Number(match[2])), month) : null;
  }
  return null;
}

const dateOnly = (date: Date | null) => (date ? date.toISOString().slice(0, 10) : null);

function parseRow(values: Record<string, unknown>): { row: ParsedRow; errors: string[] } {
  const errors: string[] = [];
  const fields: MedicineFields = {};

  for (const [field, max] of Object.entries(TEXT_FIELDS) as Array<[TextField, number]>) {
    const text = toText(values[field]);
    if (text === undefined) continue;
    if (text.length > max) errors.push(`${field} is longer than ${max} characters`);
    else fields[field] = text;
  }
  if (typeof fields.name === 'string' && fields.name.length < 2) {
    errors.push('Medicine name must be at least 2 characters');
  }

  for (const field of MONEY_FIELDS) {
    const amount = toMoney(values[field]);
    if (amount === null) errors.push(`${field.toUpperCase()} "${String(values[field])}" is not a valid amount`);
    else if (amount !== undefined) fields[field] = amount;
  }

  const sample = toBoolean(values.sampleAvailable);
  if (sample === null) errors.push('Sample available must be Yes or No');
  else if (sample !== undefined) fields.sampleAvailable = sample;

  const status = toText(values.status)?.toUpperCase();
  if (status !== undefined) {
    if (status === RecordStatuses.ACTIVE || status === RecordStatuses.INACTIVE) fields.status = status;
    else errors.push('Status must be ACTIVE or INACTIVE');
  }

  const row: ParsedRow = { fields };

  const batchNo = toText(values.batchNo);
  if (batchNo !== undefined) {
    if (batchNo.length > 60) errors.push('Batch number is longer than 60 characters');
    else row.batchNo = batchNo;
  }

  for (const key of ['expiryDate', 'mfgDate'] as const) {
    const date = toDate(values[key]);
    if (date === null) {
      errors.push(`${key === 'expiryDate' ? 'Expiry' : 'Manufacturing'} date "${String(values[key])}" is not a valid date`);
    } else if (date !== undefined) {
      row[key] = date;
    }
  }

  const quantityText = toText(values.quantity);
  if (quantityText !== undefined) {
    const quantity = Number(quantityText.replace(/,/g, ''));
    if (!Number.isInteger(quantity) || quantity < 0) {
      errors.push(`Quantity "${quantityText}" must be a whole number, 0 or more`);
    } else if (quantity > 0) {
      row.quantity = quantity;
    }
  }

  return { row, errors };
}

const toPrismaData = (data: MedicineFields) => {
  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(data)) {
    out[field] =
      (MONEY_FIELDS as readonly string[]).includes(field) && typeof value === 'number'
        ? new Prisma.Decimal(value)
        : value;
  }
  return out;
};

/**
 * MedicineImportService — bulk create / update of the product catalog from a
 * spreadsheet, with stock received into the default warehouse.
 *
 * The whole file is planned first against an in-memory copy of the catalog,
 * so the preview and the real import share one code path and later rows see
 * the effect of earlier ones (row 2 creates "Jovamox 500", row 3 adds a second
 * batch to it). The commit re-plans inside the transaction, so it acts on the
 * catalog as it is at that moment, not as it was when the preview was drawn.
 */
export class MedicineImportService {
  private static instance: MedicineImportService | null = null;

  private constructor(
    private readonly medicines = MedicineRepository.getInstance(),
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly ledger = StockLedgerService.getInstance(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): MedicineImportService {
    if (!MedicineImportService.instance) {
      MedicineImportService.instance = new MedicineImportService();
    }
    return MedicineImportService.instance;
  }

  public async import(dto: ImportMedicinesDto, actorId: number) {
    const prisma = this.medicines.getPrisma();

    if (dto.dryRun) {
      const plan = await this.plan(dto, prisma);
      return this.toResult(plan, true);
    }

    const { planned: plan, receipt } = await prisma.$transaction(
      async (tx) => {
        const planned = await this.plan(dto, tx);

        // Every unit received by this import belongs to ONE goods receipt (GRN),
        // so "kab aaya, kisne daala, kis file se" is answerable later.
        const stockOps = planned.rows.flatMap((row, index) =>
          row.action === 'error'
            ? []
            : (planned.ops[index] ?? []).filter(
                (op): op is Extract<ImportOp, { kind: 'stock' }> => op.kind === 'stock',
              ),
        );
        let grn: { id: number; receiptNo: string } | null = null;
        if (stockOps.length > 0 && planned.warehouseId !== null) {
          grn = await tx.stockReceipt.create({
            data: {
              receiptNo: this.generateReceiptNo(),
              receiptDate: dto.receiptDate ? parseDateOnly(dto.receiptDate) : todayDateOnly(),
              source: dto.source ?? null,
              invoiceNo: dto.invoiceNo ?? null,
              fileName: dto.fileName ?? null,
              note: 'Bulk medicine import',
              totalUnits: stockOps.reduce((sum, op) => sum + op.qty, 0),
              lineCount: stockOps.length,
              createdBy: actorId,
            },
            select: { id: true, receiptNo: true },
          });
        }

        for (const [index, row] of planned.rows.entries()) {
          if (row.action === 'error') continue;
          const rowOps = planned.ops[index] ?? [];
          for (const op of rowOps) {
            await this.execute(op, planned.warehouseId, actorId, tx, grn?.id);
          }
          // Newly created ids are only known now; surface them in the result.
          const created = rowOps.find((op) => op.kind === 'createMedicine');
          if (created) row.medicineId = created.medicine.id;
        }
        return { planned, receipt: grn };
      },
      { maxWait: 10_000, timeout: 180_000 },
    );

    const result = this.toResult(plan, false, receipt);
    await this.audits
      .log({
        userId: actorId,
        action: 'IMPORT',
        entity: 'Medicine',
        metadata: result.summary,
      })
      .catch(() => undefined);
    return result;
  }

  private toResult(plan: Plan, dryRun: boolean, receipt?: { id: number; receiptNo: string } | null) {
    const count = (action: ImportRowResult['action']) =>
      plan.rows.filter((row) => row.action === action).length;
    return {
      dryRun,
      summary: {
        total: plan.rows.length,
        create: count('create'),
        update: count('update'),
        unchanged: count('unchanged'),
        error: count('error'),
        unitsReceived: plan.rows
          .filter((row) => row.action !== 'error')
          .reduce((sum, row) => sum + (row.stock?.incoming ?? 0), 0),
        /** GRN created for this import's stock — null on previews / catalog-only files. */
        receiptId: receipt?.id ?? null,
        receiptNo: receipt?.receiptNo ?? null,
      },
      rows: plan.rows,
    };
  }

  /** `GRN-20261001-3F2A` — date is business-local, suffix is random. */
  private generateReceiptNo(): string {
    const stamp = toLocalDateString().replace(/-/g, '');
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    return `GRN-${stamp}-${suffix}`;
  }

  private async plan(dto: ImportMedicinesDto, client: StockTxnClient): Promise<Plan> {
    const warehouseId = await this.ledger.findDefaultWarehouseId();
    const [existing, flow, balances] = await Promise.all([
      client.medicine.findMany({ include: { batches: true } }),
      warehouseId === null
        ? Promise.resolve(new Map<number, { received: number; out: number }>())
        : this.stockTxns.getWarehouseFlowByMedicine(warehouseId, client),
      warehouseId === null
        ? Promise.resolve([])
        : client.stockBalance.groupBy({
            by: ['medicineId'],
            where: { holderType: HolderTypes.WAREHOUSE, holderId: warehouseId },
            _sum: { qty: true },
          }),
    ]);
    const availableById = new Map(balances.map((row) => [row.medicineId, row._sum.qty ?? 0]));

    const bySku = new Map<string, MedicineState>();
    const byCode = new Map<string, MedicineState>();
    const byName = new Map<string, MedicineState[]>();
    const byNameStrength = new Map<string, MedicineState[]>();
    /** sku / code still held by soft-deleted rows — the unique index counts them. */
    const deletedSkus = new Set<string>();
    const deletedCodes = new Set<string>();

    const index = (state: MedicineState) => {
      const { sku, code, name, strength } = state.fields;
      if (typeof sku === 'string') bySku.set(lower(sku), state);
      if (typeof code === 'string') byCode.set(lower(code), state);
      if (typeof name === 'string') {
        const push = (map: Map<string, MedicineState[]>, key: string) => {
          const list = map.get(key) ?? [];
          if (!list.includes(state)) list.push(state);
          map.set(key, list);
        };
        push(byName, lower(name));
        push(byNameStrength, nameKey(name, strength));
      }
    };

    for (const medicine of existing) {
      if (medicine.deletedAt) {
        if (medicine.sku) deletedSkus.add(lower(medicine.sku));
        if (medicine.code) deletedCodes.add(lower(medicine.code));
        continue;
      }
      const fields = {} as Record<MedicineField, FieldValue>;
      for (const field of MEDICINE_FIELDS) {
        const value = medicine[field];
        fields[field] = value instanceof Prisma.Decimal ? Number(value) : (value ?? null);
      }
      const live = medicine.batches
        .filter((batch) => !batch.deletedAt)
        // Same order as the catalog's "primary batch": earliest expiry, undated last.
        .sort((a, b) => (a.expiryDate?.getTime() ?? Infinity) - (b.expiryDate?.getTime() ?? Infinity));
      const moved = flow.get(medicine.id);
      index({
        id: medicine.id,
        isNew: false,
        fields,
        batches: live.map((batch) => ({
          id: batch.id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          mfgDate: batch.mfgDate,
        })),
        deletedBatchNos: new Set(
          medicine.batches.filter((batch) => batch.deletedAt).map((batch) => lower(batch.batchNo)),
        ),
        received: moved?.received ?? 0,
        out: moved?.out ?? 0,
        available: availableById.get(medicine.id) ?? 0,
      });
    }

    const rows: ImportRowResult[] = [];
    const ops: ImportOp[][] = [];
    /** "<medicine>|<batch>" → first row number, to catch the same line twice. */
    const seen = new Map<string, number>();
    const stateIds = new Map<MedicineState, number>();
    const stateKey = (state: MedicineState) => {
      if (!stateIds.has(state)) stateIds.set(state, stateIds.size + 1);
      return stateIds.get(state)!;
    };

    for (const input of dto.rows) {
      const { row, errors } = parseRow(input.values);
      const result: ImportRowResult = {
        rowNumber: input.rowNumber,
        action: 'error',
        medicineId: null,
        medicineName: typeof row.fields.name === 'string' ? row.fields.name : null,
        matchedBy: null,
        changes: [],
        stock: null,
        errors,
      };
      const rowOps: ImportOp[] = [];
      rows.push(result);
      ops.push(rowOps);

      const sku = typeof row.fields.sku === 'string' ? row.fields.sku : undefined;
      const code = typeof row.fields.code === 'string' ? row.fields.code : undefined;
      const name = typeof row.fields.name === 'string' ? row.fields.name : undefined;
      if (!sku && !code && !name) {
        errors.push('Row needs a medicine name, SKU or product code');
      }
      if (errors.length > 0) continue;

      // ── Find the medicine this row is about ─────────────────────────────────
      let target: MedicineState | undefined;
      if (sku && bySku.has(lower(sku))) {
        target = bySku.get(lower(sku));
        result.matchedBy = 'sku';
      } else if (code && byCode.has(lower(code))) {
        target = byCode.get(lower(code));
        result.matchedBy = 'code';
      } else if (name) {
        const strength = row.fields.strength ?? null;
        const candidates =
          strength !== null
            ? (byNameStrength.get(nameKey(name, strength)) ?? [])
            : (byName.get(lower(name)) ?? []);
        if (candidates.length > 1) {
          errors.push(
            `${candidates.length} medicines are named "${name}" — add the SKU or strength to pick one`,
          );
          continue;
        }
        target = candidates[0];
        if (target) result.matchedBy = 'name';
      }

      if (target) {
        // A name match must not silently re-key a product that already has its own SKU / code.
        if (sku && typeof target.fields.sku === 'string' && lower(target.fields.sku) !== lower(sku)) {
          errors.push(`Matches "${target.fields.name}" by ${result.matchedBy}, but its SKU is ${target.fields.sku}`);
        }
        if (code && typeof target.fields.code === 'string' && lower(target.fields.code) !== lower(code)) {
          errors.push(`Matches "${target.fields.name}" by ${result.matchedBy}, but its product code is ${target.fields.code}`);
        }
      } else {
        if (!name) errors.push('New medicine needs a name');
        if (row.fields.mrp === undefined) errors.push('New medicine needs an MRP');
      }
      if (sku && deletedSkus.has(lower(sku)) && !target) {
        errors.push(`SKU ${sku} belongs to a deleted medicine`);
      }
      if (code && deletedCodes.has(lower(code)) && !target) {
        errors.push(`Product code ${code} belongs to a deleted medicine`);
      }
      if (row.quantity && warehouseId === null) {
        errors.push('No default warehouse is set up, so stock cannot be received (Settings → stock.default_warehouse_id)');
      }
      if (errors.length > 0) continue;

      // ── Work out what changes, without touching state yet ───────────────────
      const medicine: MedicineState = target ?? {
        id: null,
        isNew: true,
        fields: Object.fromEntries(MEDICINE_FIELDS.map((field) => [field, null])) as Record<
          MedicineField,
          FieldValue
        >,
        batches: [],
        deletedBatchNos: new Set(),
        received: 0,
        out: 0,
        available: 0,
      };
      if (!target) {
        // New products default the same way the "Add Medicine" form does.
        medicine.fields.sampleAvailable = true;
        medicine.fields.status = RecordStatuses.ACTIVE;
      }

      const fieldChanges: MedicineFields = {};
      for (const field of MEDICINE_FIELDS) {
        const next = row.fields[field];
        if (next === undefined) continue; // blank cell: keep what is there
        const current = medicine.fields[field];
        const same =
          typeof next === 'string' && typeof current === 'string' && (field === 'sku' || field === 'code')
            ? lower(next) === lower(current)
            : next === current;
        if (!same) {
          fieldChanges[field] = next;
          result.changes.push({ field, from: current, to: next });
        }
      }

      const batchNo = row.batchNo;
      let batch = batchNo
        ? medicine.batches.find((candidate) => lower(candidate.batchNo) === lower(batchNo))
        : medicine.batches[0];
      if (batchNo && !batch && medicine.deletedBatchNos.has(lower(batchNo))) {
        errors.push(`Batch ${batchNo} of this medicine was deleted earlier — use a new batch number`);
        continue;
      }

      const batchLabel = (batch?.batchNo ?? batchNo ?? '').toLowerCase();
      const duplicateKey = `${stateKey(medicine)}|${batchLabel}`;
      const firstRow = seen.get(duplicateKey);
      if (firstRow !== undefined) {
        errors.push(`Same medicine and batch as row ${firstRow}`);
        continue;
      }

      // A new product always gets a batch, exactly like the single "Add Medicine" form.
      const needsBatch =
        !batch && (Boolean(batchNo) || Boolean(row.quantity) || Boolean(row.expiryDate) || medicine.isNew);
      const newBatch: BatchState | null = needsBatch
        ? {
            id: null,
            batchNo: batchNo ?? `B-${Date.now()}-${input.rowNumber}`,
            expiryDate: row.expiryDate ?? null,
            mfgDate: row.mfgDate ?? null,
          }
        : null;

      const batchChanges: { expiryDate?: Date; mfgDate?: Date } = {};
      if (batch) {
        for (const key of ['expiryDate', 'mfgDate'] as const) {
          const next = row[key];
          if (next && dateOnly(next) !== dateOnly(batch[key])) {
            batchChanges[key] = next;
            result.changes.push({
              field: `${key}:${batch.batchNo}`,
              from: dateOnly(batch[key]),
              to: dateOnly(next),
            });
          }
        }
      } else if (newBatch) {
        result.changes.push({ field: 'batch', from: null, to: newBatch.batchNo });
        if (newBatch.expiryDate) {
          result.changes.push({ field: 'expiryDate', from: null, to: dateOnly(newBatch.expiryDate) });
        }
      }

      const stockBatch = batch ?? newBatch;
      if (row.quantity && stockBatch) {
        result.stock = {
          batchNo: stockBatch.batchNo,
          newBatch: !batch,
          received: medicine.received,
          out: medicine.out,
          available: medicine.available,
          incoming: row.quantity,
          after: medicine.available + row.quantity,
        };
      }

      // ── Commit the row to state and queue its writes ─────────────────────────
      seen.set(duplicateKey, input.rowNumber);

      if (medicine.isNew && !target) {
        rowOps.push({ kind: 'createMedicine', medicine, data: { ...medicine.fields, ...fieldChanges } });
      } else if (Object.keys(fieldChanges).length > 0) {
        rowOps.push({ kind: 'updateMedicine', medicine, data: fieldChanges });
      }
      Object.assign(medicine.fields, fieldChanges);
      if (!target) index(medicine);

      if (newBatch) {
        rowOps.push({ kind: 'createBatch', medicine, batch: newBatch });
        medicine.batches.push(newBatch);
      } else if (batch && Object.keys(batchChanges).length > 0) {
        rowOps.push({ kind: 'updateBatch', batch, data: batchChanges });
        Object.assign(batch, batchChanges);
      }

      if (row.quantity && stockBatch) {
        // A product's very first stock is its opening stock; anything later is a receipt.
        const opening = medicine.received === 0 && medicine.isNew;
        rowOps.push({ kind: 'stock', medicine, batch: stockBatch, qty: row.quantity, opening });
        medicine.received += row.quantity;
        medicine.available += row.quantity;
      }

      result.medicineId = medicine.id;
      result.medicineName = typeof medicine.fields.name === 'string' ? medicine.fields.name : null;
      result.action = medicine.isNew && !target ? 'create' : rowOps.length > 0 ? 'update' : 'unchanged';
    }

    return { rows, ops, warehouseId };
  }

  private async execute(
    op: ImportOp,
    warehouseId: number | null,
    actorId: number,
    tx: StockTxnClient,
    receiptId?: number,
  ): Promise<void> {
    switch (op.kind) {
      case 'createMedicine': {
        const created = await tx.medicine.create({
          data: {
            ...(toPrismaData(op.data) as Prisma.MedicineCreateInput),
            createdBy: actorId,
            updatedBy: actorId,
          },
        });
        op.medicine.id = created.id;
        return;
      }
      case 'updateMedicine':
        await tx.medicine.update({
          where: { id: op.medicine.id! },
          data: { ...(toPrismaData(op.data) as Prisma.MedicineUpdateInput), updatedBy: actorId },
        });
        return;
      case 'createBatch': {
        const created = await this.stockTxns.createBatch(
          {
            medicineId: op.medicine.id!,
            batchNo: op.batch.batchNo,
            expiryDate: op.batch.expiryDate,
            mfgDate: op.batch.mfgDate,
            status: RecordStatuses.ACTIVE,
            createdBy: actorId,
            updatedBy: actorId,
          },
          tx,
        );
        op.batch.id = created.id;
        return;
      }
      case 'updateBatch':
        await tx.batch.update({
          where: { id: op.batch.id! },
          data: { ...op.data, updatedBy: actorId },
        });
        return;
      case 'stock': {
        const common = {
          medicineId: op.medicine.id!,
          batchId: op.batch.id!,
          qty: op.qty,
          txnDate: new Date(),
          note: 'Bulk import',
          createdBy: actorId,
        };
        // With a GRN, every posting references it so the receipt's lines can be
        // replayed from the ledger (refType RECEIPT, refId → stock_receipts.id).
        const ref =
          receiptId !== undefined
            ? { refType: 'RECEIPT' as const, refId: receiptId }
            : { refType: 'MANUAL' as const };
        if (op.opening) {
          await this.ledger.postOpening({
            ...common,
            ...ref,
            warehouseId: warehouseId!,
            client: tx,
          });
        } else {
          await this.ledger.postTxn(
            {
              ...common,
              ...ref,
              txnType: StockTxnTypes.RECEIPT,
              toHolderType: HolderTypes.WAREHOUSE,
              toHolderId: warehouseId!,
            },
            tx,
          );
        }
        return;
      }
    }
  }
}
