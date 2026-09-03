import { api } from '@/api/client';
import type { ApiSuccess, Role } from '@/types';
import type { LeaveBalance } from '@/services/leaves.service';

export interface EmployeeListRow {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  status: string;
  employeeCode: string | null;
  designation: string | null;
  assignedArea: string | null;
  joiningDate: string | null;
  exitDate: string | null;
  photoUrl: string | null;
  manager: { id: number; fullName: string; role: string } | null;
  territory: { id: number; name: string } | null;
  lastLoginAt: string | null;
  monthPresent: number;
  monthAbsent: number;
  monthLeave: number;
  leaveEntitled: number;
  leaveUsed: number;
  leaveRemaining: number;
}

export interface EmployeeProfile {
  id: number;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
  manager: { id: number; fullName: string; email: string; role: string } | null;
  territory: { id: number; name: string; type: string } | null;
  directReports: number;
  employment: {
    employeeCode: string | null;
    designation: string | null;
    joiningDate: string | null;
    assignedArea: string | null;
    exitDate: string | null;
    exitReason: string | null;
    tenureMonths: number | null;
  };
  personal: {
    dob: string | null;
    gender: string | null;
    bloodGroup: string | null;
    maritalStatus: string | null;
    qualification: string | null;
    address: string | null;
    photoUrl: string | null;
    emergencyName: string | null;
    emergencyPhone: string | null;
  };
  statutory: {
    panNumber: string | null;
    aadhaarNumber: string | null;
    bankName: string | null;
    bankAccountNo: string | null;
    bankIfsc: string | null;
  };
  leave: {
    year: number;
    balances: LeaveBalance[];
    totals: { entitled: number; used: number; pending: number; remaining: number };
    recent: Array<{
      id: number;
      leaveTypeCode: string;
      leaveTypeName: string;
      colorHex: string;
      fromDate: string;
      toDate: string;
      days: number;
      status: string;
      reason: string;
    }>;
  };
  attendance: {
    month: {
      userId: number;
      from: string;
      to: string;
      present: number;
      late: number;
      absent: number;
      leave: number;
      holiday: number;
      office: number;
      jointWork: number;
      flagged: number;
      workingHours: number;
    };
    year: {
      year: number;
      present: number;
      late: number;
      absent: number;
      leave: number;
      holiday: number;
      flagged: number;
      workingHours: number;
    };
  };
  activity: {
    visits: number;
    appointments: number;
    assignedDoctors: number;
    samplesGiven: number;
    salesCount: number;
    salesAmount: number;
  };
}

export interface EmployeeProfilePayload {
  designation?: string | null;
  dob?: string | null;
  gender?: string | null;
  bloodGroup?: string | null;
  maritalStatus?: string | null;
  qualification?: string | null;
  emergencyName?: string | null;
  emergencyPhone?: string | null;
  photoUrl?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfsc?: string | null;
  address?: string | null;
  assignedArea?: string | null;
  joiningDate?: string | null;
  exitDate?: string | null;
  exitReason?: string | null;
}

export const employeesApi = {
  async list(
    params: { search?: string; role?: 'MANAGER' | 'MR'; status?: string; limit?: number } = {},
  ): Promise<EmployeeListRow[]> {
    const { data } = await api.get<ApiSuccess<EmployeeListRow[]>>('/employees', {
      params: { limit: 200, ...params },
    });
    return data.data;
  },
  async me(params: { month?: string; year?: number } = {}): Promise<EmployeeProfile> {
    const { data } = await api.get<ApiSuccess<EmployeeProfile>>('/employees/me', { params });
    return data.data;
  },
  async profile(
    id: number,
    params: { month?: string; year?: number } = {},
  ): Promise<EmployeeProfile> {
    const { data } = await api.get<ApiSuccess<EmployeeProfile>>(`/employees/${id}`, { params });
    return data.data;
  },
  async update(id: number, payload: EmployeeProfilePayload): Promise<EmployeeProfile> {
    const { data } = await api.patch<ApiSuccess<EmployeeProfile>>(`/employees/${id}`, payload);
    return data.data;
  },
};
