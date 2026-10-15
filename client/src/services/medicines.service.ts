import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export interface Medicine {
  id: number;
  name: string;
  brandName?: string | null;
  genericName?: string | null;
  company: string | null;
  category: string | null;
  strength: string | null;
  composition?: string | null;
  packSize: string | null;
  mrp: number;
  batchNumber?: string | null;
  expiryDate?: string | null;
  sampleAvailable: boolean;
  status: string;
  stock: {
    openingStock: number;
    received?: number;
    issued: number;
    returned: number;
    writeOff?: number;
    available: number;
    minimumStockAlert: number;
    isLow: boolean;
  } | null;
}

export interface CreateMedicinePayload {
  name: string;
  brandName?: string;
  genericName?: string;
  company?: string;
  category?: string;
  strength?: string;
  composition?: string;
  packSize?: string;
  mrp: number;
  batchNumber?: string;
  expiryDate?: string;
  openingStock?: number;
  minimumStockAlert?: number;
  sampleAvailable?: boolean;
}

export interface MedicineDetails {
  profile: Medicine;
  stats: {
    samplesIssued: number;
    currentStock: number;
    remainingStock: number;
    openingStock: number;
    issuedStock: number;
    issuedToMr?: number;
    companyRemaining?: number;
    mrRecipients: number;
    doctorRecipients: number;
  };
  mrHoldings?: Array<{
    mrId: number;
    fullName: string;
    email: string;
    quantity: number;
    batchNumber: string | null;
  }>;
  mrWise: Array<{
    mrId: number;
    fullName: string;
    email: string | null;
    quantity: number;
    issues: number;
  }>;
  doctorWise: Array<{
    doctorId: number;
    fullName: string;
    quantity: number;
    issues: number;
  }>;
  timeline: Array<{
    id: number;
    date: string;
    quantity: number;
    batchNumber: string | null;
    doctorName: string;
    mrName: string;
    visitId: number;
    visitDate: string;
  }>;
}

export type ImportFieldValue = string | number | boolean | null;

export interface MedicineImportRowResult {
  rowNumber: number;
  action: 'create' | 'update' | 'unchanged' | 'error';
  medicineId: number | null;
  medicineName: string | null;
  matchedBy: 'sku' | 'code' | 'name' | null;
  changes: Array<{ field: string; from: ImportFieldValue; to: ImportFieldValue }>;
  stock: {
    batchNo: string;
    newBatch: boolean;
    received: number;
    out: number;
    available: number;
    incoming: number;
    after: number;
  } | null;
  errors: string[];
}

export interface MedicineImportResult {
  dryRun: boolean;
  summary: {
    total: number;
    create: number;
    update: number;
    unchanged: number;
    error: number;
    unitsReceived: number;
    /** GRN created for the received units — null on previews / catalog-only files. */
    receiptId?: number | null;
    receiptNo?: string | null;
  };
  rows: MedicineImportRowResult[];
}

export interface MedicineImportPayload {
  dryRun: boolean;
  /** Spreadsheet name, stamped on the GRN (stock receipt). */
  fileName?: string;
  source?: string;
  invoiceNo?: string;
  receiptDate?: string;
  rows: Array<{ rowNumber: number; values: Record<string, string | number> }>;
}

export const medicinesApi = {
  async list(search?: string): Promise<Medicine[]> {
    // Screens filter and page client-side, so fetch the whole catalog, not the API's first 20.
    const { data } = await api.get<ApiSuccess<Medicine[]>>('/medicines', {
      params: { limit: 2000, ...(search ? { search } : {}) },
    });
    return data.data;
  },
  async importRows(payload: MedicineImportPayload): Promise<MedicineImportResult> {
    const { data } = await api.post<ApiSuccess<MedicineImportResult>>('/medicines/import', payload, {
      // A few thousand rows run in one transaction on the server.
      timeout: 180_000,
    });
    return data.data;
  },
  async getDetails(id: number): Promise<MedicineDetails> {
    const { data } = await api.get<ApiSuccess<MedicineDetails>>(`/medicines/${id}/details`);
    return data.data;
  },
  async create(payload: CreateMedicinePayload): Promise<Medicine> {
    const { data } = await api.post<ApiSuccess<Medicine>>('/medicines', payload);
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/medicines/${id}`);
  },
};
