import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type ExpenseCategory =
  | 'TRAVEL'
  | 'DAILY_ALLOWANCE'
  | 'HOTEL'
  | 'FOOD'
  | 'PHONE'
  | 'STATIONERY'
  | 'OTHER';

export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID' | 'CANCELLED';

export interface ExpenseClaim {
  id: number;
  userId: number;
  employee: {
    id: number;
    fullName: string;
    email: string;
    role: string;
    employeeCode: string | null;
  } | null;
  expenseDate: string;
  category: ExpenseCategory;
  amount: number;
  distanceKm: number | null;
  description: string;
  receiptFileKey: string | null;
  status: ExpenseStatus;
  decisionRemark: string | null;
  actedAt: string | null;
  decidedBy: { id: number; fullName: string } | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ExpensePayload {
  expenseDate: string;
  category: ExpenseCategory;
  amount: number;
  distanceKm?: number;
  description: string;
  receiptFileKey?: string;
}

export interface ExpenseSummaryRow {
  userId: number;
  fullName: string;
  pending: number;
  approved: number;
  paid: number;
  rejected: number;
  total: number;
  claims: number;
}

export const expensesApi = {
  async list(
    params: { month?: string; status?: ExpenseStatus; userId?: number } = {},
  ): Promise<ExpenseClaim[]> {
    const { data } = await api.get<ApiSuccess<ExpenseClaim[]>>('/expenses', {
      params: { limit: 200, ...params },
    });
    return data.data;
  },
  async create(payload: ExpensePayload): Promise<ExpenseClaim> {
    const { data } = await api.post<ApiSuccess<ExpenseClaim>>('/expenses', payload);
    return data.data;
  },
  async update(id: number, payload: Partial<ExpensePayload>): Promise<ExpenseClaim> {
    const { data } = await api.patch<ApiSuccess<ExpenseClaim>>(`/expenses/${id}`, payload);
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/expenses/${id}`);
  },
  async decide(
    id: number,
    payload: { status: 'APPROVED' | 'REJECTED'; remark?: string },
  ): Promise<ExpenseClaim> {
    const { data } = await api.post<ApiSuccess<ExpenseClaim>>(`/expenses/${id}/decide`, payload);
    return data.data;
  },
  async markPaid(id: number): Promise<ExpenseClaim> {
    const { data } = await api.post<ApiSuccess<ExpenseClaim>>(`/expenses/${id}/mark-paid`);
    return data.data;
  },
  async summary(params: { month?: string } = {}): Promise<{
    month: string;
    users: ExpenseSummaryRow[];
  }> {
    const { data } = await api.get<ApiSuccess<{ month: string; users: ExpenseSummaryRow[] }>>(
      '/expenses/summary',
      { params },
    );
    return data.data;
  },
};

export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  TRAVEL: 'Travel (TA)',
  DAILY_ALLOWANCE: 'Daily allowance (DA)',
  HOTEL: 'Hotel / stay',
  FOOD: 'Food',
  PHONE: 'Phone / internet',
  STATIONERY: 'Stationery',
  OTHER: 'Other',
};

export const EXPENSE_STATUS_TONE: Record<
  ExpenseStatus,
  'warning' | 'success' | 'danger' | 'primary' | 'neutral'
> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  PAID: 'primary',
  CANCELLED: 'neutral',
};

export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}
