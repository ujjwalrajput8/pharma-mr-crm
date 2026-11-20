import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type StatementStatus = 'NEW' | 'DRAFT' | 'SUBMITTED';

export interface StatementStockist {
  id: number;
  name: string;
  city: string | null;
  ownerName: string | null;
  mr: { id: number; fullName: string } | null;
}

export interface StatementLine {
  medicineId: number;
  name: string;
  opening: number;
  receipt: number;
  sales: number;
  returns: number;
  closing: number;
  rate: number | null;
  salesValue: number | null;
  closingValue: number | null;
}

export interface Statement {
  store: { id: number; name: string };
  month: string;
  id: number | null;
  status: StatementStatus;
  submittedAt: string | null;
  remarks: string | null;
  mr: { id: number; fullName: string } | null;
  openingFromPrevious: boolean;
  previousMonth: { month: string; status: string } | null;
  lines: StatementLine[];
  can: { edit: boolean; correct: boolean };
}

export interface StatementSummary {
  store: { id: number; name: string };
  period: 'quarter' | 'year';
  label: string;
  months: Array<{ month: string; status: 'DRAFT' | 'SUBMITTED' | 'MISSING' }>;
  rows: Array<Omit<StatementLine, 'name'> & { name: string }>;
  totals: { receipt: number; sales: number; returns: number; salesValue: number; closingValue: number };
}

export interface SaveStatementPayload {
  storeId: number;
  month: string;
  lines: Array<{ medicineId: number; opening?: number; receipt: number; sales: number; returns: number }>;
  remarks?: string;
  submit?: boolean;
  reason?: string;
}

export const stockistStatementsApi = {
  async stockists(): Promise<StatementStockist[]> {
    const { data } = await api.get<ApiSuccess<StatementStockist[]>>('/stockist-statements/stockists');
    return data.data;
  },
  async overview(month: string): Promise<Array<StatementStockist & { status: 'MISSING' | 'DRAFT' | 'SUBMITTED'; submittedAt: string | null }>> {
    const { data } = await api.get<ApiSuccess<Array<StatementStockist & { status: 'MISSING' | 'DRAFT' | 'SUBMITTED'; submittedAt: string | null }>>>(
      '/stockist-statements/overview',
      { params: { month } },
    );
    return data.data;
  },
  async get(storeId: number, month: string): Promise<Statement> {
    const { data } = await api.get<ApiSuccess<Statement>>('/stockist-statements', { params: { storeId, month } });
    return data.data;
  },
  async save(payload: SaveStatementPayload): Promise<Statement> {
    const { data } = await api.put<ApiSuccess<Statement>>('/stockist-statements', payload);
    return data.data;
  },
  async summary(params: { storeId: number; period: 'quarter' | 'year'; year: number; quarter?: number }): Promise<StatementSummary> {
    const { data } = await api.get<ApiSuccess<StatementSummary>>('/stockist-statements/summary', { params });
    return data.data;
  },
};
