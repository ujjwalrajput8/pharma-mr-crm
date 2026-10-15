import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type LedgerHolderType = 'WAREHOUSE' | 'USER' | 'DOCTOR' | 'CHEMIST';

export interface LedgerHolderRef {
  type: LedgerHolderType;
  id: number;
  name: string | null;
}

export interface LedgerTxn {
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
  /** Populated when refType is RECEIPT. */
  receiptNo: string | null;
  note: string | null;
  createdBy: { id: number; fullName: string } | null;
  /** Holder balance after this row — only when medicine + one holder are filtered. */
  runningBalance: number | null;
}

export interface LedgerMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface LedgerTxnFilters {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  medicineId?: number;
  batchId?: number;
  txnType?: string;
  refType?: string;
  createdBy?: number;
  holderType?: LedgerHolderType;
  holderId?: number;
  search?: string;
}

export interface LedgerTxnsResult {
  items: LedgerTxn[];
  summary: { totalIn: number; totalOut: number; byType: Record<string, number> };
  meta: LedgerMeta;
}

export interface StockReceipt {
  id: number;
  receiptNo: string;
  receiptDate: string;
  source: string | null;
  invoiceNo: string | null;
  fileName: string | null;
  note: string | null;
  totalUnits: number;
  lineCount: number;
  createdAt: string;
  createdBy: { id: number; fullName: string } | null;
}

export interface StatementBatchRow {
  batch: { id: number; batchNo: string; expiryDate: string | null };
  opening: number;
  received: number;
  issued: number;
  writeOff: number;
  sold: number;
  closing: number;
  currentBalance: number;
  /** null when the period ends before today — live balances are not comparable. */
  matches: boolean | null;
}

export interface StatementItem {
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
  batches: StatementBatchRow[];
}

export interface LedgerStatement {
  warehouseId: number | null;
  from: string;
  to: string;
  balancesAsOf: string;
  items: StatementItem[];
  summary: {
    medicines: number;
    receivedUnits: number;
    issuedUnits: number;
    writeOffUnits: number;
    soldUnits: number;
    mismatches: number;
  };
}

/** Axios skips undefined params — strip '' filter blanks too. */
function cleanParams(params: object): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  );
}

export const ledgerApi = {
  async listTxns(filters: LedgerTxnFilters = {}): Promise<LedgerTxnsResult> {
    const { data } = await api.get<
      ApiSuccess<{ items: LedgerTxn[]; summary: LedgerTxnsResult['summary'] }>
    >('/ledger/txns', { params: cleanParams(filters) });
    return { ...data.data, meta: data.meta as unknown as LedgerMeta };
  },

  async listReceipts(
    params: { page?: number; limit?: number; from?: string; to?: string } = {},
  ): Promise<{ items: StockReceipt[]; meta: LedgerMeta }> {
    const { data } = await api.get<ApiSuccess<StockReceipt[]>>('/ledger/receipts', {
      params: cleanParams(params),
    });
    return { items: data.data, meta: data.meta as unknown as LedgerMeta };
  },

  async getReceipt(id: number): Promise<{ receipt: StockReceipt; txns: LedgerTxn[] }> {
    const { data } = await api.get<ApiSuccess<{ receipt: StockReceipt; txns: LedgerTxn[] }>>(
      `/ledger/receipts/${id}`,
    );
    return data.data;
  },

  async statement(
    params: { from?: string; to?: string; medicineId?: number } = {},
  ): Promise<LedgerStatement> {
    const { data } = await api.get<ApiSuccess<LedgerStatement>>('/ledger/statement', {
      params: cleanParams(params),
    });
    return data.data;
  },
};
