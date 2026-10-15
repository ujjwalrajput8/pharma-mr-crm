import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';
export type PaymentMode = 'CASH' | 'UPI' | 'CHEQUE' | 'BANK_TRANSFER' | 'CREDIT_NOTE' | 'OTHER';

export const PAYMENT_MODES: PaymentMode[] = [
  'CASH',
  'UPI',
  'CHEQUE',
  'BANK_TRANSFER',
  'CREDIT_NOTE',
  'OTHER',
];

export interface InvoiceParty {
  type: 'DOCTOR' | 'STORE';
  id: number;
  name: string;
}

export interface InvoiceListRow {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string | null;
  remarks: string | null;
  status: InvoiceStatus;
  party: InvoiceParty | null;
  mr: { id: number; fullName: string };
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  lineCount: number;
  createdAt: string;
}

export interface InvoiceLine {
  id: number;
  medicine: { id: number; name: string };
  quantity: number;
  rate: number | null;
  discountPct: number;
  amount: number;
}

export interface InvoicePayment {
  id: number;
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  reference: string | null;
  remarks: string | null;
  createdAt: string;
}

export interface InvoiceDetail extends InvoiceListRow {
  lines: InvoiceLine[];
  payments: InvoicePayment[];
}

export interface CreateInvoiceLinePayload {
  medicineId: number;
  quantity: number;
  rate: number;
  discountPct?: number;
}

export interface CreateInvoicePayload {
  doctorId?: number;
  medicalStoreId?: number;
  mrId?: number;
  invoiceDate: string;
  dueDate?: string;
  remarks?: string;
  lines: CreateInvoiceLinePayload[];
}

export interface RecordPaymentPayload {
  amount: number;
  paymentDate: string;
  mode: PaymentMode;
  reference?: string;
  remarks?: string;
}

export interface ListInvoicesParams {
  doctorId?: number;
  medicalStoreId?: number;
  mrId?: number;
  status?: InvoiceStatus;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface InvoiceSummaryGroup {
  id: number;
  name: string;
  invoices: number;
  billed: number;
  paid: number;
  outstanding: number;
  lastInvoiceDate: string | null;
}

export interface InvoiceSummary {
  groupBy: 'doctor' | 'store' | 'mr';
  from: string | null;
  to: string | null;
  groups: InvoiceSummaryGroup[];
  totals: { invoices: number; billed: number; paid: number; outstanding: number };
}

export const invoicesApi = {
  async list(params: ListInvoicesParams = {}): Promise<InvoiceListRow[]> {
    // Screens filter and page client-side; pull a generous window.
    const { data } = await api.get<ApiSuccess<InvoiceListRow[]>>('/invoices', {
      params: { limit: 500, ...params },
    });
    return data.data;
  },
  async get(id: number): Promise<InvoiceDetail> {
    const { data } = await api.get<ApiSuccess<InvoiceDetail>>(`/invoices/${id}`);
    return data.data;
  },
  async create(payload: CreateInvoicePayload): Promise<InvoiceDetail> {
    const { data } = await api.post<ApiSuccess<InvoiceDetail>>('/invoices', payload);
    return data.data;
  },
  async addPayment(id: number, payload: RecordPaymentPayload): Promise<InvoiceDetail> {
    const { data } = await api.post<ApiSuccess<InvoiceDetail>>(`/invoices/${id}/payments`, payload);
    return data.data;
  },
  async removePayment(id: number, paymentId: number): Promise<InvoiceDetail> {
    const { data } = await api.delete<ApiSuccess<InvoiceDetail>>(
      `/invoices/${id}/payments/${paymentId}`,
    );
    return data.data;
  },
  async cancel(id: number): Promise<InvoiceDetail> {
    const { data } = await api.post<ApiSuccess<InvoiceDetail>>(`/invoices/${id}/cancel`);
    return data.data;
  },
  async summary(
    params: { from?: string; to?: string; groupBy?: 'doctor' | 'store' | 'mr' } = {},
  ): Promise<InvoiceSummary> {
    const { data } = await api.get<ApiSuccess<InvoiceSummary>>('/invoices/summary', { params });
    return data.data;
  },
};
