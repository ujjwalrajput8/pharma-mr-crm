import type { StockRefType, StockTxn } from '@prisma/client';
import { HolderTypes, StockTxnTypes } from '../constants';
import {
  StockTxnRepository,
  type PostTxnInput,
  type StockTxnClient,
} from '../repositories/StockTxnRepository';
import { SettingRepository } from '../repositories/SettingRepository';
import { BadRequestError } from '../errors/AppError';

const DEFAULT_WAREHOUSE_SETTING = 'stock.default_warehouse_id';

/**
 * StockLedgerService — atomic stock postings (append-only txns + balance rollups).
 */
export class StockLedgerService {
  private static instance: StockLedgerService | null = null;

  private constructor(
    private readonly stockTxns = StockTxnRepository.getInstance(),
    private readonly settings = SettingRepository.getInstance(),
  ) {}

  public static getInstance(): StockLedgerService {
    if (!StockLedgerService.instance) {
      StockLedgerService.instance = new StockLedgerService();
    }
    return StockLedgerService.instance;
  }

/**
   * Required for any stock *write*. Reads must use `findDefaultWarehouseId()`
   * so a not-yet-configured install shows empty stock instead of a 500.
   */
  public async getDefaultWarehouseId(): Promise<number> {
    const warehouseId = await this.findDefaultWarehouseId();
    if (warehouseId === null) {
      throw new BadRequestError(
        'No default warehouse configured. Set the "stock.default_warehouse_id" setting to a warehouse id.',
      );
    }
    return warehouseId;
  }

  /** `null` when the setting is missing or malformed — safe for read paths. */
  public async findDefaultWarehouseId(): Promise<number | null> {
    const setting = await this.settings.findByKey(DEFAULT_WAREHOUSE_SETTING);
    if (!setting) return null;
    const warehouseId = Number(setting.value);
    return Number.isInteger(warehouseId) && warehouseId > 0 ? warehouseId : null;
  }

  /**
   * Stock writes need a default warehouse, and a fresh install has none. Called
   * on server boot: adopts the first live warehouse (or creates `MAIN`) and points
   * the setting at it. A setting that already names a live warehouse is left alone.
   */
  public async ensureDefaultWarehouse(): Promise<void> {
    const prisma = this.stockTxns.getPrisma();

    const currentId = await this.findDefaultWarehouseId();
    if (currentId !== null) {
      const current = await prisma.warehouse.findFirst({
        where: { id: currentId, deletedAt: null },
      });
      if (current) return;
    }

    const warehouse =
      (await prisma.warehouse.findFirst({ where: { deletedAt: null }, orderBy: { id: 'asc' } })) ??
      (await prisma.warehouse.upsert({
        where: { code: 'MAIN' },
        create: { name: 'Main Warehouse', code: 'MAIN', status: 'ACTIVE' },
        update: { status: 'ACTIVE', deletedAt: null },
      }));

    await prisma.setting.upsert({
      where: { key: DEFAULT_WAREHOUSE_SETTING },
      create: { key: DEFAULT_WAREHOUSE_SETTING, value: String(warehouse.id), group: 'stock' },
      update: { value: String(warehouse.id), group: 'stock', deletedAt: null },
    });
  }

  public async postTxn(
    input: PostTxnInput,
    client?: StockTxnClient,
  ): Promise<StockTxn> {
    if (input.qty <= 0) {
      throw new Error('INVALID_QTY');
    }

    if (client) {
      return this.postTxnInClient(client, input);
    }

    return this.stockTxns.getPrisma().$transaction((tx) => this.postTxnInClient(tx, input));
  }

  public async postOpening(params: {
    warehouseId: number;
    medicineId: number;
    batchId: number;
    qty: number;
    txnDate: Date;
    note?: string;
    createdBy: number;
    /** Defaults to MANUAL; imports pass RECEIPT + the GRN's stock_receipts id. */
    refType?: StockRefType;
    refId?: number;
    client?: StockTxnClient;
  }): Promise<StockTxn> {
    return this.postTxn(
      {
        txnType: StockTxnTypes.OPENING,
        txnDate: params.txnDate,
        medicineId: params.medicineId,
        batchId: params.batchId,
        qty: params.qty,
        toHolderType: HolderTypes.WAREHOUSE,
        toHolderId: params.warehouseId,
        refType: params.refType ?? 'MANUAL',
        refId: params.refId,
        note: params.note ?? 'Opening stock',
        createdBy: params.createdBy,
      },
      params.client,
    );
  }

  public async issueToMr(params: {
    fromHolderType: typeof HolderTypes.WAREHOUSE | typeof HolderTypes.USER;
    fromHolderId: number;
    mrId: number;
    medicineId: number;
    batchId: number;
    qty: number;
    txnDate: Date;
    note?: string;
    createdBy: number;
    client?: StockTxnClient;
  }): Promise<StockTxn> {
    return this.postTxn(
      {
        txnType: StockTxnTypes.ISSUE,
        txnDate: params.txnDate,
        medicineId: params.medicineId,
        batchId: params.batchId,
        qty: params.qty,
        fromHolderType: params.fromHolderType,
        fromHolderId: params.fromHolderId,
        toHolderType: HolderTypes.USER,
        toHolderId: params.mrId,
        refType: 'ISSUE',
        note: params.note,
        createdBy: params.createdBy,
      },
      params.client,
    );
  }

  public async giveSample(params: {
    mrId: number;
    doctorId: number;
    medicineId: number;
    batchId: number;
    qty: number;
    visitId: number;
    txnDate: Date;
    note?: string;
    createdBy: number;
    client?: StockTxnClient;
  }): Promise<StockTxn> {
    return this.postTxn(
      {
        txnType: StockTxnTypes.SAMPLE_GIVEN,
        txnDate: params.txnDate,
        medicineId: params.medicineId,
        batchId: params.batchId,
        qty: params.qty,
        fromHolderType: HolderTypes.USER,
        fromHolderId: params.mrId,
        toHolderType: HolderTypes.DOCTOR,
        toHolderId: params.doctorId,
        refType: 'VISIT',
        refId: params.visitId,
        note: params.note,
        createdBy: params.createdBy,
      },
      params.client,
    );
  }

  public async postAdjustment(params: {
    warehouseId: number;
    medicineId: number;
    batchId: number;
    quantityDelta: number;
    txnDate: Date;
    note?: string;
    createdBy: number;
    /** Defaults to MANUAL; a positive adjust with a receipt passes RECEIPT + its id. */
    refType?: StockRefType;
    refId?: number;
    client?: StockTxnClient;
  }): Promise<StockTxn> {
    const qty = Math.abs(params.quantityDelta);
    if (params.quantityDelta > 0) {
      return this.postTxn(
        {
          txnType: StockTxnTypes.ADJUSTMENT,
          txnDate: params.txnDate,
          medicineId: params.medicineId,
          batchId: params.batchId,
          qty,
          toHolderType: HolderTypes.WAREHOUSE,
          toHolderId: params.warehouseId,
          refType: params.refType ?? 'MANUAL',
          refId: params.refId,
          note: params.note,
          createdBy: params.createdBy,
        },
        params.client,
      );
    }

    return this.postTxn(
      {
        txnType: StockTxnTypes.ADJUSTMENT,
        txnDate: params.txnDate,
        medicineId: params.medicineId,
        batchId: params.batchId,
        qty,
        fromHolderType: HolderTypes.WAREHOUSE,
        fromHolderId: params.warehouseId,
        refType: params.refType ?? 'MANUAL',
        refId: params.refId,
        note: params.note,
        createdBy: params.createdBy,
      },
      params.client,
    );
  }

  private isBalanceTrackedHolder(holderType: PostTxnInput['toHolderType']): boolean {
    return holderType === HolderTypes.WAREHOUSE || holderType === HolderTypes.USER;
  }

  private async postTxnInClient(
    client: StockTxnClient,
    input: PostTxnInput,
  ): Promise<StockTxn> {
    if (input.fromHolderType != null && input.fromHolderId != null) {
      await this.stockTxns.decrementBalance(
        {
          holderType: input.fromHolderType,
          holderId: input.fromHolderId,
          medicineId: input.medicineId,
          batchId: input.batchId,
          qty: input.qty,
        },
        client,
      );
    }

    const txn = await this.stockTxns.createTxn(
      {
        txnNo: this.stockTxns.generateTxnNo(),
        txnType: input.txnType,
        txnDate: input.txnDate,
        medicineId: input.medicineId,
        batchId: input.batchId,
        qty: input.qty,
        fromHolderType: input.fromHolderType ?? null,
        fromHolderId: input.fromHolderId ?? null,
        toHolderType: input.toHolderType ?? null,
        toHolderId: input.toHolderId ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        note: input.note ?? null,
        clientUuid: input.clientUuid ?? null,
        createdBy: input.createdBy,
      },
      client,
    );

    if (
      input.toHolderType != null &&
      input.toHolderId != null &&
      this.isBalanceTrackedHolder(input.toHolderType)
    ) {
      await this.stockTxns.incrementBalance(
        {
          holderType: input.toHolderType,
          holderId: input.toHolderId,
          medicineId: input.medicineId,
          batchId: input.batchId,
          qty: input.qty,
        },
        client,
      );
    }

    return txn;
  }
}
