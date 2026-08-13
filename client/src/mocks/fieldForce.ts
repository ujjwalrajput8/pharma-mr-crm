/** Frontend-only mock data for Field Force UI (backend wire-up later). */

export type StockTxnType =
  | 'OPENING'
  | 'TRANSFER'
  | 'ISSUE'
  | 'SAMPLE_GIVEN'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT'
  | 'EXPIRY_WRITEOFF';

export interface MockCall {
  id: string;
  doctorName: string;
  speciality: string;
  clinic: string;
  priority: 'A' | 'B' | 'C';
  slot: string;
  status: 'pending' | 'done' | 'skipped';
  lastVisit: string | null;
  hasAppointment: boolean;
}

export interface MockStockBalance {
  productName: string;
  batchNo: string;
  expiryDate: string;
  qty: number;
  holder: string;
}

export interface MockLedgerRow {
  id: string;
  txnDate: string;
  txnType: StockTxnType;
  productName: string;
  batchNo: string;
  qty: number;
  fromLabel: string;
  toLabel: string;
  ref: string;
}

export interface MockApproval {
  id: string;
  kind: 'tour_plan' | 'attendance_flag' | 'doctor_request' | 'expense';
  title: string;
  subtitle: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface MockTourDay {
  date: string;
  beat: string;
  workType: string;
  doctors: string[];
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
}

export const MOCK_CALL_LIST: MockCall[] = [
  {
    id: 'c1',
    doctorName: 'Dr. Mehta',
    speciality: 'Cardiology',
    clinic: 'Heart Care Clinic, Andheri',
    priority: 'A',
    slot: '10:00',
    status: 'pending',
    lastVisit: '2026-07-28',
    hasAppointment: true,
  },
  {
    id: 'c2',
    doctorName: 'Dr. Sharma',
    speciality: 'GP',
    clinic: 'City Care, Bandra',
    priority: 'B',
    slot: '11:30',
    status: 'pending',
    lastVisit: '2026-07-15',
    hasAppointment: false,
  },
  {
    id: 'c3',
    doctorName: 'Dr. Khan',
    speciality: 'Ortho',
    clinic: 'Bone & Joint, Dadar',
    priority: 'A',
    slot: '14:00',
    status: 'done',
    lastVisit: '2026-08-12',
    hasAppointment: true,
  },
  {
    id: 'c4',
    doctorName: 'Dr. Iyer',
    speciality: 'Dermatology',
    clinic: 'Skin First, Powai',
    priority: 'C',
    slot: '16:00',
    status: 'pending',
    lastVisit: null,
    hasAppointment: false,
  },
];

export const MOCK_MY_STOCK: MockStockBalance[] = [
  {
    productName: 'Zincoboom 500',
    batchNo: 'ZB2411',
    expiryDate: '2027-03-31',
    qty: 116,
    holder: 'MR Bag',
  },
  {
    productName: 'Zincoboom 500',
    batchNo: 'ZB2502',
    expiryDate: '2026-11-15',
    qty: 40,
    holder: 'MR Bag',
  },
  {
    productName: 'Calciplus Softgel',
    batchNo: 'CP2408',
    expiryDate: '2026-10-01',
    qty: 24,
    holder: 'MR Bag',
  },
  {
    productName: 'Neurovit Forte',
    batchNo: 'NV2412',
    expiryDate: '2027-06-30',
    qty: 60,
    holder: 'MR Bag',
  },
];

export const MOCK_LEDGER: MockLedgerRow[] = [
  {
    id: 't1',
    txnDate: '2026-08-04',
    txnType: 'TRANSFER',
    productName: 'Zincoboom 500',
    batchNo: 'ZB2411',
    qty: 600,
    fromLabel: 'Warehouse',
    toLabel: 'ASM — West Mumbai',
    ref: '—',
  },
  {
    id: 't2',
    txnDate: '2026-08-05',
    txnType: 'ISSUE',
    productName: 'Zincoboom 500',
    batchNo: 'ZB2411',
    qty: 150,
    fromLabel: 'ASM — West Mumbai',
    toLabel: 'MR — Rahul Patil',
    ref: 'issue:88',
  },
  {
    id: 't3',
    txnDate: '2026-08-07',
    txnType: 'SAMPLE_GIVEN',
    productName: 'Zincoboom 500',
    batchNo: 'ZB2411',
    qty: 10,
    fromLabel: 'MR — Rahul Patil',
    toLabel: 'Dr. Mehta',
    ref: 'visit:9021',
  },
  {
    id: 't4',
    txnDate: '2026-08-12',
    txnType: 'SAMPLE_GIVEN',
    productName: 'Calciplus Softgel',
    batchNo: 'CP2408',
    qty: 6,
    fromLabel: 'MR — Rahul Patil',
    toLabel: 'Dr. Khan',
    ref: 'visit:9055',
  },
  {
    id: 't5',
    txnDate: '2026-08-28',
    txnType: 'RETURN',
    productName: 'Zincoboom 500',
    batchNo: 'ZB2411',
    qty: 20,
    fromLabel: 'MR — Rahul Patil',
    toLabel: 'ASM — West Mumbai',
    ref: 'return:14',
  },
  {
    id: 't6',
    txnDate: '2026-08-31',
    txnType: 'ADJUSTMENT',
    productName: 'Zincoboom 500',
    batchNo: 'ZB2411',
    qty: -4,
    fromLabel: 'MR — Rahul Patil',
    toLabel: 'Shrinkage',
    ref: 'count:7',
  },
];

export const MOCK_APPROVALS: MockApproval[] = [
  {
    id: 'a1',
    kind: 'tour_plan',
    title: 'MTP August 2026',
    subtitle: '22 planned calls · West Mumbai beat',
    requestedBy: 'Rahul Patil (MR)',
    requestedAt: '2026-08-01 09:12',
    status: 'pending',
  },
  {
    id: 'a2',
    kind: 'attendance_flag',
    title: 'Flagged check-in',
    subtitle: 'Mock GPS suspected · accuracy 180m',
    requestedBy: 'Sneha Desai (MR)',
    requestedAt: '2026-08-13 08:41',
    status: 'pending',
  },
  {
    id: 'a3',
    kind: 'doctor_request',
    title: 'New doctor request',
    subtitle: 'Dr. Banerjee · Dermatology · Powai',
    requestedBy: 'Rahul Patil (MR)',
    requestedAt: '2026-08-12 18:05',
    status: 'pending',
  },
  {
    id: 'a4',
    kind: 'expense',
    title: 'TA/DA claim — Aug week 1',
    subtitle: '₹2,450 · 4 bills attached',
    requestedBy: 'Amit Joshi (MR)',
    requestedAt: '2026-08-10 20:22',
    status: 'pending',
  },
];

export const MOCK_TOUR_DAYS: MockTourDay[] = [
  {
    date: '2026-08-14',
    beat: 'Andheri East',
    workType: 'Field',
    doctors: ['Dr. Mehta', 'Dr. Sharma'],
    status: 'approved',
  },
  {
    date: '2026-08-15',
    beat: 'Bandra West',
    workType: 'Field',
    doctors: ['Dr. Iyer', 'Dr. Khan'],
    status: 'approved',
  },
  {
    date: '2026-08-16',
    beat: 'HQ',
    workType: 'Office',
    doctors: [],
    status: 'submitted',
  },
  {
    date: '2026-08-18',
    beat: 'Powai',
    workType: 'Joint work',
    doctors: ['Dr. Banerjee'],
    status: 'draft',
  },
];

export function daysUntilExpiry(expiryDate: string): number {
  const end = new Date(`${expiryDate}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
