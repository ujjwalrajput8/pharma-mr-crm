import { AppRoles } from '../constants';
import type {
  EmployeeProfileQueryDto,
  ListEmployeesQueryDto,
  UpdateEmployeeProfileDto,
} from '../dto/employee.dto';
import { ForbiddenError, NotFoundError } from '../errors/AppError';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { EmployeeRepository } from '../repositories/EmployeeRepository';
import { LeaveRepository } from '../repositories/LeaveRepository';
import { UserRepository } from '../repositories/UserRepository';
import { AttendanceService } from './AttendanceService';
import { LeaveService } from './LeaveService';
import { TeamScopeService } from './TeamScopeService';
import {
  currentYear,
  formatDateOnly,
  monthRange,
  parseDateOnly,
  todayDateOnly,
} from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

/**
 * EmployeeService — the people side of the CRM: directory, one full profile
 * (personal + statutory + leave entitlement + attendance register) and HR edits.
 */
export class EmployeeService {
  private static instance: EmployeeService | null = null;

  private constructor(
    private readonly employees = EmployeeRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly attendanceRepo = AttendanceRepository.getInstance(),
    private readonly leaves = LeaveRepository.getInstance(),
    private readonly leaveService = LeaveService.getInstance(),
    private readonly attendanceService = AttendanceService.getInstance(),
    private readonly scope = TeamScopeService.getInstance(),
  ) {}

  public static getInstance(): EmployeeService {
    if (!EmployeeService.instance) EmployeeService.instance = new EmployeeService();
    return EmployeeService.instance;
  }

  /** Directory — Admin sees everyone, a Manager sees their reporting line. */
  public async list(query: ListEmployeesQueryDto, actor: AuthUser) {
    if (actor.role === AppRoles.MR) {
      throw new ForbiddenError('Only Admin or Manager can browse the employee directory');
    }

    const visibleIds = await this.scope.visibleUserIds(actor);
    const { items, total } = await this.employees.list({
      page: query.page,
      limit: query.limit,
      search: query.search,
      role: query.role,
      status: query.status,
      managerId: query.managerId,
      userIds: visibleIds,
    });

    const today = todayDateOnly();
    const { start, end } = monthRange(today);
    const year = currentYear();

    const rows = await Promise.all(
      items.map(async (user) => {
        const [attendance, balances] = await Promise.all([
          this.attendanceRepo.summarize(user.id, start, end),
          this.leaveService.balancesFor(user.id, year),
        ]);
        const counts: Record<string, number> = {};
        for (const row of attendance.byStatus) counts[row.status] = row.count;

        const paid = balances.filter((b) => b.isPaid && !b.unlimited);
        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          status: user.status,
          employeeCode: user.mrProfile?.employeeCode ?? null,
          designation: user.mrProfile?.designation ?? null,
          assignedArea: user.mrProfile?.assignedArea ?? null,
          joiningDate: user.mrProfile?.joiningDate
            ? formatDateOnly(user.mrProfile.joiningDate)
            : null,
          exitDate: user.mrProfile?.exitDate ? formatDateOnly(user.mrProfile.exitDate) : null,
          photoUrl: user.mrProfile?.photoUrl ?? null,
          manager: user.manager
            ? { id: user.manager.id, fullName: user.manager.fullName, role: user.manager.role }
            : null,
          territory: user.territory ? { id: user.territory.id, name: user.territory.name } : null,
          lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
          monthPresent: (counts.PRESENT ?? 0) + (counts.LATE ?? 0),
          monthAbsent: counts.ABSENT ?? 0,
          monthLeave: counts.LEAVE ?? 0,
          leaveEntitled: paid.reduce((sum, b) => sum + b.entitled, 0),
          leaveUsed: paid.reduce((sum, b) => sum + b.used, 0),
          leaveRemaining: paid.reduce((sum, b) => sum + b.remaining, 0),
        };
      }),
    );

    return {
      items: rows,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  /** Everything about one employee, in one round trip. */
  public async profile(userId: number, query: EmployeeProfileQueryDto, actor: AuthUser) {
    if (userId !== actor.id) {
      if (actor.role === AppRoles.MR) {
        throw new ForbiddenError('You can only view your own profile');
      }
      await this.scope.assertCanSee(actor, userId);
    }

    const user = await this.employees.findFullById(userId);
    if (!user || user.deletedAt) throw new NotFoundError('Employee not found');

    const year = query.year ?? currentYear();
    const monthAnchor = query.month ? parseDateOnly(query.month) : todayDateOnly();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year, 11, 31));

    const [balances, monthSummary, yearSummary, recentLeaves, reports, activity] =
      await Promise.all([
        this.leaveService.balancesFor(userId, year),
        this.attendanceService.summary(
          { userId, month: formatDateOnly(monthAnchor) },
          { ...actor, role: AppRoles.ADMIN },
        ),
        this.attendanceRepo.summarize(userId, yearStart, yearEnd),
        this.leaves.listRequests({
          page: 1,
          limit: 10,
          userId,
          from: yearStart,
          to: yearEnd,
        }),
        this.users.listReportIds(userId),
        this.employees.activityCounts(userId, monthRange(monthAnchor)),
      ]);

    const yearCounts: Record<string, number> = {};
    for (const row of yearSummary.byStatus) yearCounts[row.status] = row.count;

    const profile = user.mrProfile;
    const paid = balances.filter((b) => b.isPaid && !b.unlimited);

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      manager: user.manager
        ? {
            id: user.manager.id,
            fullName: user.manager.fullName,
            email: user.manager.email,
            role: user.manager.role,
          }
        : null,
      territory: user.territory
        ? { id: user.territory.id, name: user.territory.name, type: user.territory.type }
        : null,
      directReports: reports.length,

      employment: {
        employeeCode: profile?.employeeCode ?? null,
        designation: profile?.designation ?? null,
        joiningDate: profile?.joiningDate ? formatDateOnly(profile.joiningDate) : null,
        assignedArea: profile?.assignedArea ?? null,
        exitDate: profile?.exitDate ? formatDateOnly(profile.exitDate) : null,
        exitReason: profile?.exitReason ?? null,
        tenureMonths: profile?.joiningDate ? this.monthsSince(profile.joiningDate) : null,
      },
      personal: {
        dob: profile?.dob ? formatDateOnly(profile.dob) : null,
        gender: profile?.gender ?? null,
        bloodGroup: profile?.bloodGroup ?? null,
        maritalStatus: profile?.maritalStatus ?? null,
        qualification: profile?.qualification ?? null,
        address: profile?.address ?? null,
        photoUrl: profile?.photoUrl ?? null,
        emergencyName: profile?.emergencyName ?? null,
        emergencyPhone: profile?.emergencyPhone ?? null,
      },
      /** Statutory / payout details — Admin-only in the UI. */
      statutory: {
        panNumber: profile?.panNumber ?? null,
        aadhaarNumber: profile?.aadhaarNumber ?? null,
        bankName: profile?.bankName ?? null,
        bankAccountNo: profile?.bankAccountNo ?? null,
        bankIfsc: profile?.bankIfsc ?? null,
      },

      leave: {
        year,
        balances,
        totals: {
          entitled: paid.reduce((sum, b) => sum + b.entitled, 0),
          used: paid.reduce((sum, b) => sum + b.used, 0),
          pending: balances.reduce((sum, b) => sum + b.pending, 0),
          remaining: paid.reduce((sum, b) => sum + b.remaining, 0),
        },
        recent: recentLeaves.items.map((row) => ({
          id: row.id,
          leaveTypeCode: row.leaveType.code,
          leaveTypeName: row.leaveType.name,
          colorHex: row.leaveType.colorHex,
          fromDate: formatDateOnly(row.fromDate),
          toDate: formatDateOnly(row.toDate),
          days: Number(row.days),
          status: row.status,
          reason: row.reason,
        })),
      },

      attendance: {
        month: monthSummary,
        year: {
          year,
          present: yearCounts.PRESENT ?? 0,
          late: yearCounts.LATE ?? 0,
          absent: yearCounts.ABSENT ?? 0,
          leave: yearCounts.LEAVE ?? 0,
          holiday: yearCounts.HOLIDAY ?? 0,
          flagged: yearCounts.FLAGGED ?? 0,
          workingHours: Number((yearSummary.workingMins / 60).toFixed(1)),
        },
      },

      activity,
    };
  }

  public async updateProfile(
    userId: number,
    dto: UpdateEmployeeProfileDto,
    actor: AuthUser,
  ) {
    if (actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('Only an administrator can edit employee records');
    }
    const user = await this.employees.findFullById(userId);
    if (!user || user.deletedAt) throw new NotFoundError('Employee not found');
    if (!user.mrProfile) {
      throw new NotFoundError('This account has no employee profile to edit');
    }

    const dateFields = ['dob', 'joiningDate', 'exitDate'] as const;
    const data: Record<string, unknown> = { updatedBy: actor.id };

    for (const [key, value] of Object.entries(dto)) {
      if (value === undefined) continue;
      if ((dateFields as readonly string[]).includes(key)) {
        data[key] = value === null ? null : parseDateOnly(value as string);
      } else {
        data[key] = value;
      }
    }

    await this.employees.updateProfile(user.mrProfile.id, data);
    return this.profile(userId, {}, actor);
  }

  private monthsSince(date: Date): number {
    const now = todayDateOnly();
    return Math.max(
      0,
      (now.getUTCFullYear() - date.getUTCFullYear()) * 12 +
        (now.getUTCMonth() - date.getUTCMonth()),
    );
  }
}
