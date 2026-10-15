import type { HolderType, Prisma } from '@prisma/client';
import { HolderTypes, StockTxnTypes } from '../constants';
import type {
  LedgerStatementQueryDto,
  ListLedgerReceiptsQueryDto,
  ListLedgerTxnsQueryDto,
} from '../dto/ledger.dto';
import { NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { formatDateOnly, parseDateOnly, toLocalDateString } from '../utils/datetime';
import { StockLedgerService } from './StockLedgerService';

/** One side of a movement, with the holder's display name resolved. */
export interface LedgerHolderRef {
  type: HolderType;
  id: number;
  name: string | null;
}

export interface LedgerTxnRow {
  id: number;
  txnNo: string;
  txnDate: string;
  createdAt: string;
  txnType: string;
  qty: number;
  medicine: { id: number; name: string };
  batch: { id: number; batchNo: string; expiryDate: string | null };
  from: LedgerHolderRef | null;
  to: LedgerHolderRef | null;
  refType: string | null;
  refId: number | null;
  /** Populated when refType is RECEIPT (joined from stock_receipts). */
  receiptNo: string | null;
  note: string | null;
  createdBy: { id: number; fullName: string } | null;
  /**
   * Balance of the filtered holder right after this row. Only present when the
   * query pins one medicine (optionally one batch) AND one holder.
   */
  runningBalance: number | null;
}

type TxnWithRelations = Prisma.StockTxnGetPayload<{ include: typeof txnInclude }>;

const txnInclude = {
  medicine: { select: { id: true, name: true } },
  batch: { select: { id: true, batchNo: true, expiryDate: true } },
  creator: { select: { id: true, fullName: true } },
} as const;

const WRITEOFF_TYPES: ReadonlySet<string> = new Set([
  StockTxnTypes.EXPIRY_WRITEOFF,
  StockTxnTypes.LOST,
  StockTxnTypes.ADJUSTMENT,
]);

/**
 * LedgerQueryService — read-only explorer over the append-only stock ledger:
 * "kab kab stock aaya, kisne daala" and the statement that must reconcile
 * against stock_balances.
 */
export class LedgerQueryService {
  private static instance: LedgerQueryService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly ledger = StockLedgerService.getInstance(),
  ) {}

  public static getInstance(): LedgerQueryService {
    if (!LedgerQueryService.instance) {
      LedgerQueryService.instance = new LedgerQueryService();
    }
    return LedgerQueryService.instance;
  }

  // ── Holder names ────────────────────────────────────────────────────────────

  /**
   * Resolves display names for (holderType, holderId) pairs in four bulk
   * queries: WAREHOUSE→warehouses.name, USER→users.fullName,
   * DOCTOR→doctors.fullName, CHEMIST→medical_stores.name.
   */
  public async resolveHolderNames(
    pairs: Array<{ type: HolderType | null; id: number | null }>,
  ): Promise<Map<string, string>> {
    const idsByType = new Map<HolderType, Set<number>>();
    for (const pair of pairs) {
      if (!pair.type || pair.id == null) continue;
      const set = idsByType.get(pair.type) ?? new Set<number>();
      set.add(pair.id);
      idsByType.set(pair.type, set);
    }

    const ids = (type: HolderType) => [...(idsByType.get(type) ?? [])];
    const [warehouses, users, doctors, stores] = await Promise.all([
      ids(HolderTypes.WAREHOUSE).length
        ? this.prisma.warehouse.findMany({
            where: { id: { in: ids(HolderTypes.WAREHOUSE) } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      ids(HolderTypes.USER).length
        ? this.prisma.user.findMany({
            where: { id: { in: ids(HolderTypes.USER) } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      ids(HolderTypes.DOCTOR).length
        ? this.prisma.doctor.findMany({
            where: { id: { in: ids(HolderTypes.DOCTOR) } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      ids(HolderTypes.CHEMIST).length
        ? this.prisma.medicalStore.findMany({
            where: { id: { in: ids(HolderTypes.CHEMIST) } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
    ]);

    const names = new Map<string, string>();
    for (const row of warehouses) names.set(`${HolderTypes.WAREHOUSE}:${row.id}`, row.name);
    for (const row of users) names.set(`${HolderTypes.USER}:${row.id}`, row.fullName);
    for (const row of doctors) names.set(`${HolderTypes.DOCTOR}:${row.id}`, row.fullName);
    for (const row of stores) names.set(`${HolderTypes.CHEMIST}:${row.id}`, row.name);
    return names;
  }

  // ── Transactions ────────────────────────────────────────────────────────────

  public async listTxns(query: ListLedgerTxnsQueryDto) {
    const holder =
      query.holderType !== undefined && query.holderId !== undefined
        ? { type: query.holderType as HolderType, id: query.holderId }
        : null;

    const and: Prisma.StockTxnWhereInput[] = [];
    if (query.from || query.to) {
      and.push({
        txnDate: {
          ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
          ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
        },
      });
    }
    if (query.medicineId) and.push({ medicineId: query.medicineId });
    if (query.batchId) and.push({ batchId: query.batchId });
    if (query.txnType) and.push({ txnType: query.txnType });
    if (query.refType) and.push({ refType: query.refType });
    if (query.createdBy) and.push({ createdBy: query.createdBy });
    if (holder) {
      and.push({
        OR: [
          { fromHolderType: holder.type, fromHolderId: holder.id },
          { toHolderType: holder.type, toHolderId: holder.id },
        ],
      });
    }
    if (query.search) {
      const contains = { contains: query.search, mode: 'insensitive' as const };
      and.push({ OR: [{ txnNo: contains }, { note: contains }, { medicine: { name: contains } }] });
    }
    const where: Prisma.StockTxnWhereInput = and.length > 0 ? { AND: and } : {};

    const [items, total, inAgg, outAgg, byType] = await Promise.all([
      this.prisma.stockTxn.findMany({
        where,
        orderBy: [{ txnDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: txnInclude,
      }),
      this.prisma.stockTxn.count({ where }),
      this.prisma.stockTxn.aggregate({
        where: {
          AND: [
            ...and,
            holder
              ? { toHolderType: holder.type, toHolderId: holder.id }
              : { toHolderId: { not: null } },
          ],
        },
        _sum: { qty: true },
      }),
      this.prisma.stockTxn.aggregate({
        where: {
          AND: [
            ...and,
            holder
              ? { fromHolderType: holder.type, fromHolderId: holder.id }
              : { fromHolderId: { not: null } },
          ],
        },
        _sum: { qty: true },
      }),
      this.prisma.stockTxn.groupBy({ by: ['txnType'], where, _sum: { qty: true } }),
    ]);

    const [names, receiptNos, runningBalances] = await Promise.all([
      this.resolveHolderNames(
        items.flatMap((row) => [
          { type: row.fromHolderType, id: row.fromHolderId },
          { type: row.toHolderType, id: row.toHolderId },
        ]),
      ),
      this.receiptNosFor(items),
      query.medicineId && holder
        ? this.computeRunningBalances({
            holder,
            medicineId: query.medicineId,
            batchId: query.batchId,
            from: query.from,
            to: query.to,
          })
        : Promise.resolve(null),
    ]);

    return {
      items: items.map((row) => this.toTxnRow(row, names, receiptNos, runningBalances)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
      summary: {
        totalIn: inAgg._sum.qty ?? 0,
        totalOut: outAgg._sum.qty ?? 0,
        byType: Object.fromEntries(byType.map((row) => [row.txnType, row._sum.qty ?? 0])),
      },
    };
  }

  // ── Receipts (GRN) ──────────────────────────────────────────────────────────

  public async listReceipts(query: ListLedgerReceiptsQueryDto) {
    const where: Prisma.StockReceiptWhereInput =
      query.from || query.to
        ? {
            receiptDate: {
              ...(query.from ? { gte: parseDateOnly(query.from) } : {}),
              ...(query.to ? { lte: parseDateOnly(query.to) } : {}),
            },
          }
        : {};

    const [items, total] = await Promise.all([
      this.prisma.stockReceipt.findMany({
        where,
        orderBy: [{ receiptDate: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { creator: { select: { id: true, fullName: true } } },
      }),
      this.prisma.stockReceipt.count({ where }),
    ]);

    return {
      items: items.map((row) => this.toReceipt(row)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getReceipt(id: number) {
    const receipt = await this.prisma.stockReceipt.findUnique({
      where: { id },
      include: { creator: { select: { id: true, fullName: true } } },
    });
    if (!receipt) throw new NotFoundError('Receipt not found');

    const txns = await this.prisma.stockTxn.findMany({
      where: { refType: 'RECEIPT', refId: id },
      orderBy: { id: 'asc' },
      include: txnInclude,
    });
    const names = await this.resolveHolderNames(
      txns.flatMap((row) => [
        { type: row.fromHolderType, id: row.fromHolderId },
        { type: row.toHolderType, id: row.toHolderId },
      ]),
    );
    const receiptNos = new Map<number, string>([[receipt.id, receipt.receiptNo]]);

    return {
      receipt: this.toReceipt(receipt),
      txns: txns.map((row) => this.toTxnRow(row, names, receiptNos, null)),
    };
  }

  // ── Statement (the report that must reconcile) ──────────────────────────────

  public async statement(query: LedgerStatementQueryDto) {
    const today = toLocalDateString();
    const defaultFrom = `${today.slice(0, 7)}-01`;
    const from = query.from ?? defaultFrom;
    const to = query.to ?? this.endOfMonth(from);

    const emptySummary = {
      medicines: 0,
      receivedUnits: 0,
      issuedUnits: 0,
      writeOffUnits: 0,
      soldUnits: 0,
      mismatches: 0,
    };

    const warehouseId = await this.ledger.findDefaultWarehouseId();
    if (warehouseId === null) {
      return { warehouseId: null, from, to, balancesAsOf: today, items: [], summary: emptySummary };
    }

    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);
    const medicineFilter = query.medicineId ? { medicineId: query.medicineId } : {};
    const groupKeys = ['medicineId', 'batchId', 'txnType'] as const;

    const [inBefore, outBefore, inRange, outRange, balances] = await Promise.all([
      this.prisma.stockTxn.groupBy({
        by: [...groupKeys],
        where: {
          ...medicineFilter,
          toHolderType: HolderTypes.WAREHOUSE,
          toHolderId: warehouseId,
          txnDate: { lt: fromDate },
        },
        _sum: { qty: true },
      }),
      this.prisma.stockTxn.groupBy({
        by: [...groupKeys],
        where: {
          ...medicineFilter,
          fromHolderType: HolderTypes.WAREHOUSE,
          fromHolderId: warehouseId,
          txnDate: { lt: fromDate },
        },
        _sum: { qty: true },
      }),
      this.prisma.stockTxn.groupBy({
        by: [...groupKeys],
        where: {
          ...medicineFilter,
          toHolderType: HolderTypes.WAREHOUSE,
          toHolderId: warehouseId,
          txnDate: { gte: fromDate, lte: toDate },
        },
        _sum: { qty: true },
      }),
      this.prisma.stockTxn.groupBy({
        by: [...groupKeys],
        where: {
          ...medicineFilter,
          fromHolderType: HolderTypes.WAREHOUSE,
          fromHolderId: warehouseId,
          txnDate: { gte: fromDate, lte: toDate },
        },
        _sum: { qty: true },
      }),
      this.prisma.stockBalance.findMany({
        where: { holderType: HolderTypes.WAREHOUSE, holderId: warehouseId, ...medicineFilter },
        select: { medicineId: true, batchId: true, qty: true },
      }),
    ]);

    interface Cell {
      medicineId: number;
      batchId: number;
      opening: number;
      received: number;
      issued: number;
      writeOff: number;
      sold: number;
      currentBalance: number;
    }
    const cells = new Map<string, Cell>();
    const cell = (medicineId: number, batchId: number): Cell => {
      const key = `${medicineId}:${batchId}`;
      let entry = cells.get(key);
      if (!entry) {
        entry = { medicineId, batchId, opening: 0, received: 0, issued: 0, writeOff: 0, sold: 0, currentBalance: 0 };
        cells.set(key, entry);
      }
      return entry;
    };

    for (const row of inBefore) cell(row.medicineId, row.batchId).opening += row._sum.qty ?? 0;
    for (const row of outBefore) cell(row.medicineId, row.batchId).opening -= row._sum.qty ?? 0;
    for (const row of inRange) {
      // Every inflow type to a warehouse counts as received — RECEIVED_TYPES
      // (OPENING, RECEIPT, RETURN, ADJUSTMENT-in, TRANSFER-in) is the closed
      // list today; anything new lands here too so the closing still adds up.
      cell(row.medicineId, row.batchId).received += row._sum.qty ?? 0;
    }
    for (const row of outRange) {
      const entry = cell(row.medicineId, row.batchId);
      const qty = row._sum.qty ?? 0;
      if (row.txnType === StockTxnTypes.SALE) entry.sold += qty;
      else if (WRITEOFF_TYPES.has(row.txnType)) entry.writeOff += qty;
      // ISSUE, TRANSFER-out — and any other outflow — count as issued so the
      // closing column always reconciles with the ledger.
      else entry.issued += qty;
    }
    for (const row of balances) cell(row.medicineId, row.batchId).currentBalance = row.qty;

    const medicineIds = [...new Set([...cells.values()].map((entry) => entry.medicineId))];
    const batchIds = [...new Set([...cells.values()].map((entry) => entry.batchId))];
    const [medicines, batches] = await Promise.all([
      medicineIds.length
        ? this.prisma.medicine.findMany({
            where: { id: { in: medicineIds } },
            select: { id: true, name: true },
          })
        : Promise.resolve([]),
      batchIds.length
        ? this.prisma.batch.findMany({
            where: { id: { in: batchIds } },
            select: { id: true, batchNo: true, expiryDate: true },
          })
        : Promise.resolve([]),
    ]);
    const medicineMap = new Map(medicines.map((row) => [row.id, row]));
    const batchMap = new Map(batches.map((row) => [row.id, row]));

    // `stock_balances` is a *live* rollup — it only equals the period closing
    // when the period runs up to (or past) today.
    const comparable = to >= today;

    const byMedicine = new Map<
      number,
      {
        medicine: { id: number; name: string };
        totals: {
          opening: number;
          received: number;
          issued: number;
          writeOff: number;
          sold: number;
          closing: number;
          currentBalance: number;
        };
        batches: Array<{
          batch: { id: number; batchNo: string; expiryDate: string | null };
          opening: number;
          received: number;
          issued: number;
          writeOff: number;
          sold: number;
          closing: number;
          currentBalance: number;
          matches: boolean | null;
        }>;
      }
    >();

    const summary = { ...emptySummary };

    for (const entry of [...cells.values()]) {
      const hasActivity =
        entry.opening !== 0 ||
        entry.received !== 0 ||
        entry.issued !== 0 ||
        entry.writeOff !== 0 ||
        entry.sold !== 0 ||
        entry.currentBalance !== 0;
      if (!hasActivity) continue;

      const closing = entry.opening + entry.received - entry.issued - entry.writeOff - entry.sold;
      const matches = comparable ? closing === entry.currentBalance : null;
      const batch = batchMap.get(entry.batchId);
      const medicine = medicineMap.get(entry.medicineId);

      let group = byMedicine.get(entry.medicineId);
      if (!group) {
        group = {
          medicine: { id: entry.medicineId, name: medicine?.name ?? `#${entry.medicineId}` },
          totals: { opening: 0, received: 0, issued: 0, writeOff: 0, sold: 0, closing: 0, currentBalance: 0 },
          batches: [],
        };
        byMedicine.set(entry.medicineId, group);
      }
      group.totals.opening += entry.opening;
      group.totals.received += entry.received;
      group.totals.issued += entry.issued;
      group.totals.writeOff += entry.writeOff;
      group.totals.sold += entry.sold;
      group.totals.closing += closing;
      group.totals.currentBalance += entry.currentBalance;
      group.batches.push({
        batch: {
          id: entry.batchId,
          batchNo: batch?.batchNo ?? `#${entry.batchId}`,
          expiryDate: batch?.expiryDate ? formatDateOnly(batch.expiryDate) : null,
        },
        opening: entry.opening,
        received: entry.received,
        issued: entry.issued,
        writeOff: entry.writeOff,
        sold: entry.sold,
        closing,
        currentBalance: entry.currentBalance,
        matches,
      });

      summary.receivedUnits += entry.received;
      summary.issuedUnits += entry.issued;
      summary.writeOffUnits += entry.writeOff;
      summary.soldUnits += entry.sold;
      if (matches === false) summary.mismatches += 1;
    }

    const items = [...byMedicine.values()].sort((a, b) =>
      a.medicine.name.localeCompare(b.medicine.name),
    );
    for (const item of items) {
      item.batches.sort((a, b) => a.batch.batchNo.localeCompare(b.batch.batchNo));
    }
    summary.medicines = items.length;

    return { warehouseId, from, to, balancesAsOf: today, items, summary };
  }

  // ── Internals ───────────────────────────────────────────────────────────────

  private async receiptNosFor(rows: Array<{ refType: string | null; refId: number | null }>) {
    const receiptIds = [
      ...new Set(
        rows
          .filter((row) => row.refType === 'RECEIPT' && row.refId != null)
          .map((row) => row.refId as number),
      ),
    ];
    if (receiptIds.length === 0) return new Map<number, string>();
    const receipts = await this.prisma.stockReceipt.findMany({
      where: { id: { in: receiptIds } },
      select: { id: true, receiptNo: true },
    });
    return new Map(receipts.map((row) => [row.id, row.receiptNo]));
  }

  /**
   * True balance of one holder for one medicine (optionally one batch) after
   * every movement in the window: opening before `from` + cumulative ascending.
   * Deliberately ignores txnType/search filters so the number is a real balance.
   */
  private async computeRunningBalances(params: {
    holder: { type: HolderType; id: number };
    medicineId: number;
    batchId?: number;
    from?: string;
    to?: string;
  }): Promise<Map<number, number>> {
    const base = {
      medicineId: params.medicineId,
      ...(params.batchId ? { batchId: params.batchId } : {}),
    };
    const isTo = {
      toHolderType: params.holder.type,
      toHolderId: params.holder.id,
    };
    const isFrom = {
      fromHolderType: params.holder.type,
      fromHolderId: params.holder.id,
    };

    let opening = 0;
    if (params.from) {
      const before = { txnDate: { lt: parseDateOnly(params.from) } };
      const [inAgg, outAgg] = await Promise.all([
        this.prisma.stockTxn.aggregate({ where: { ...base, ...isTo, ...before }, _sum: { qty: true } }),
        this.prisma.stockTxn.aggregate({ where: { ...base, ...isFrom, ...before }, _sum: { qty: true } }),
      ]);
      opening = (inAgg._sum.qty ?? 0) - (outAgg._sum.qty ?? 0);
    }

    const movements = await this.prisma.stockTxn.findMany({
      where: {
        ...base,
        ...(params.from || params.to
          ? {
              txnDate: {
                ...(params.from ? { gte: parseDateOnly(params.from) } : {}),
                ...(params.to ? { lte: parseDateOnly(params.to) } : {}),
              },
            }
          : {}),
        OR: [isTo, isFrom],
      },
      orderBy: [{ txnDate: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        qty: true,
        fromHolderType: true,
        fromHolderId: true,
        toHolderType: true,
        toHolderId: true,
      },
    });

    let running = opening;
    const balances = new Map<number, number>();
    for (const move of movements) {
      if (move.toHolderType === params.holder.type && move.toHolderId === params.holder.id) {
        running += move.qty;
      } else if (
        move.fromHolderType === params.holder.type &&
        move.fromHolderId === params.holder.id
      ) {
        running -= move.qty;
      }
      balances.set(move.id, running);
    }
    return balances;
  }

  private toTxnRow(
    row: TxnWithRelations,
    names: Map<string, string>,
    receiptNos: Map<number, string>,
    runningBalances: Map<number, number> | null,
  ): LedgerTxnRow {
    const holderRef = (type: HolderType | null, id: number | null): LedgerHolderRef | null =>
      type && id != null ? { type, id, name: names.get(`${type}:${id}`) ?? null } : null;

    return {
      id: row.id,
      txnNo: row.txnNo,
      txnDate: formatDateOnly(row.txnDate),
      createdAt: row.createdAt.toISOString(),
      txnType: row.txnType,
      qty: row.qty,
      medicine: { id: row.medicine.id, name: row.medicine.name },
      batch: {
        id: row.batch.id,
        batchNo: row.batch.batchNo,
        expiryDate: row.batch.expiryDate ? formatDateOnly(row.batch.expiryDate) : null,
      },
      from: holderRef(row.fromHolderType, row.fromHolderId),
      to: holderRef(row.toHolderType, row.toHolderId),
      refType: row.refType,
      refId: row.refId,
      receiptNo:
        row.refType === 'RECEIPT' && row.refId != null
          ? (receiptNos.get(row.refId) ?? null)
          : null,
      note: row.note,
      createdBy: row.creator ? { id: row.creator.id, fullName: row.creator.fullName } : null,
      runningBalance: runningBalances?.get(row.id) ?? null,
    };
  }

  private toReceipt(
    row: Prisma.StockReceiptGetPayload<{
      include: { creator: { select: { id: true; fullName: true } } };
    }>,
  ) {
    return {
      id: row.id,
      receiptNo: row.receiptNo,
      receiptDate: formatDateOnly(row.receiptDate),
      source: row.source,
      invoiceNo: row.invoiceNo,
      fileName: row.fileName,
      note: row.note,
      totalUnits: row.totalUnits,
      lineCount: row.lineCount,
      createdAt: row.createdAt.toISOString(),
      createdBy: row.creator ? { id: row.creator.id, fullName: row.creator.fullName } : null,
    };
  }

  /** Last day of the month that `YYYY-MM-DD` falls in. */
  private endOfMonth(dateOnly: string): string {
    const year = Number(dateOnly.slice(0, 4));
    const month = Number(dateOnly.slice(5, 7));
    return formatDateOnly(new Date(Date.UTC(year, month, 0)));
  }
}
