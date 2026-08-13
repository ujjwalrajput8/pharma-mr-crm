import type { StockTxn } from '../../generated/prisma/client';
import { HolderTypes, StockTxnTypes } from '../constants';
import {
  StockTxnRepository,
  type PostTxnInput,
  type StockTxnClient,
} from '../repositories/StockTxnRepository';
import { SettingRepository } from '../repositories/SettingRepository';

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

  public async getDefaultWarehouseId(): Promise<number> {
    const setting = await this.settings.findByKey(DEFAULT_WAREHOUSE_SETTING);
    if (!setting) {
      throw new Error('DEFAULT_WAREHOUSE_NOT_CONFIGURED');
    }
    const warehouseId = Number(setting.value);
    if (!Number.isInteger(warehouseId) || warehouseId <= 0) {
      throw new Error('DEFAULT_WAREHOUSE_NOT_CONFIGURED');
    }
    return warehouseId;
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
        refType: 'MANUAL',
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
          refType: 'MANUAL',
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
        refType: 'MANUAL',
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
