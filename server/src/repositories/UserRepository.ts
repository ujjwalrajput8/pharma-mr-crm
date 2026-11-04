import type { Prisma, User } from '@prisma/client';
import { PrismaService } from '../prisma/PrismaService';
import { AppRoles } from '../constants';

export interface UserListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  role?: string;
  /** Used when no single role is requested — e.g. MR + MANAGER together. */
  roles?: string[];
}

const profileSelect = {
  id: true,
  employeeCode: true,
  designation: true,
  address: true,
  joiningDate: true,
  assignedArea: true,
} as const;

const managerSelect = { id: true, fullName: true, email: true, role: true } as const;

/** Open work held by one user — see `UserRepository.pendingWork`. */
export interface PendingWork {
  /** Stock lines (medicine + batch) with quantity left in the user's bag. */
  stockItems: number;
  stockUnits: number;
  appointments: number;
  tourPlans: number;
  leave: number;
  regularization: number;
  expense: number;
}

export type UserWithProfile = User & {
  mrProfile: {
    id: number;
    employeeCode: string;
    designation: string | null;
    address: string | null;
    joiningDate: Date | null;
    assignedArea: string | null;
  } | null;
  manager?: { id: number; fullName: string; email: string; role: string } | null;
};

export class UserRepository {
  private static instance: UserRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): UserRepository {
    if (!UserRepository.instance) {
      UserRepository.instance = new UserRepository();
    }
    return UserRepository.instance;
  }

  public findByEmail(email: string): Promise<UserWithProfile | null> {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      include: { mrProfile: { select: profileSelect }, manager: { select: managerSelect } },
    });
  }

  /** Just what sign-in needs — one query, no profile / manager joins. */
  public findForLogin(email: string) {
    return this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        status: true,
        passwordHash: true,
        failedLoginCount: true,
        lockedUntil: true,
        permissionsCustomized: true,
      },
    });
  }

  /** Stamps a successful sign-in; `passwordHash` upgrades an older hash. */
  public async recordLogin(id: number, passwordHash?: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: {
        lastLoginAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: { id: true },
    });
  }

  public async listPhotos(): Promise<Array<{ userId: number; photoUrl: string }>> {
    const rows = await this.prisma.user.findMany({
      where: { deletedAt: null, photoUrl: { not: null } },
      select: { id: true, photoUrl: true },
    });
    return rows.map((row) => ({ userId: row.id, photoUrl: row.photoUrl! }));
  }

  public findById(id: number): Promise<UserWithProfile | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { mrProfile: { select: profileSelect }, manager: { select: managerSelect } },
    });
  }

  public createWithProfile(input: {
    user: Prisma.UserCreateInput;
    profile: {
      employeeCode: string;
      designation?: string;
      address?: string;
      joiningDate?: Date | null;
      assignedArea?: string;
      createdBy?: number;
      updatedBy?: number;
    };
  }): Promise<UserWithProfile> {
    return this.prisma.user.create({
      data: {
        ...input.user,
        mrProfile: {
          create: input.profile,
        },
      },
      include: { mrProfile: { select: profileSelect }, manager: { select: managerSelect } },
    });
  }

  public create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  public update(id: number, data: Prisma.UserUpdateInput): Promise<UserWithProfile> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { mrProfile: { select: profileSelect }, manager: { select: managerSelect } },
    });
  }

  public async softDelete(id: number, updatedBy?: number): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: 'INACTIVE',
        ...(updatedBy ? { updatedBy } : {}),
      },
    });
  }

  public async list(params: UserListParams): Promise<{ items: UserWithProfile[]; total: number }> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(params.role
        ? { role: params.role as Prisma.EnumRoleFilter['equals'] }
        : params.roles
          ? { role: { in: params.roles as Prisma.EnumRoleFilter['in'] } }
          : { role: AppRoles.MR }),
      ...(params.status
        ? { status: params.status as Prisma.EnumUserStatusFilter['equals'] }
        : {}),
      ...(params.search
        ? {
            OR: [
              { fullName: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
              { phone: { contains: params.search, mode: 'insensitive' } },
              { mrProfile: { employeeCode: { contains: params.search, mode: 'insensitive' } } },
              { mrProfile: { designation: { contains: params.search, mode: 'insensitive' } } },
              { mrProfile: { assignedArea: { contains: params.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { mrProfile: { select: profileSelect }, manager: { select: managerSelect } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items, total };
  }

  public countByRole(role: string): Promise<number> {
    return this.prisma.user.count({
      where: { role: role as Prisma.EnumRoleFilter['equals'], deletedAt: null },
    });
  }

  /** Direct reports (typically MRs under a Manager). */
  public async listReportIds(managerId: number): Promise<number[]> {
    const rows = await this.prisma.user.findMany({
      where: { managerId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }

  /**
   * Whole reporting sub-tree below a user (RSM → ASM → MR), excluding the root.
   * Breadth-first with a depth cap so a bad `managerId` cycle can never spin forever.
   */
  public async listDescendantIds(managerId: number, maxDepth = 6): Promise<number[]> {
    const collected = new Set<number>();
    let frontier = [managerId];

    for (let depth = 0; depth < maxDepth && frontier.length > 0; depth += 1) {
      const rows = await this.prisma.user.findMany({
        where: { managerId: { in: frontier }, deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
      });
      frontier = rows.map((row) => row.id).filter((id) => !collected.has(id));
      for (const id of frontier) collected.add(id);
    }

    collected.delete(managerId);
    return [...collected];
  }

  /**
   * Every field account's reporting link, whatever its status — loop checks must see
   * inactive people too, or A → (inactive B) → A slips through.
   */
  public listReportingLinks() {
    return this.prisma.user.findMany({
      where: { deletedAt: null, role: { in: ['MR', 'MANAGER'] } },
      select: { id: true, managerId: true },
    });
  }

  /**
   * Work still open in a user's name — it has to be settled before the account is
   * deactivated or deleted. Tour plans count from `monthStart` on: nothing moves an
   * APPROVED plan out of that status, so past months are history, not open work.
   */
  public async pendingWork(userId: number, monthStart: Date): Promise<PendingWork> {
    const [stock, appointments, tourPlans, leave, regularization, expense] = await Promise.all([
      this.prisma.stockBalance.aggregate({
        where: { holderType: 'USER', holderId: userId, qty: { gt: 0 } },
        _count: { _all: true },
        _sum: { qty: true },
      }),
      this.prisma.appointment.count({
        where: {
          mrId: userId,
          deletedAt: null,
          status: { in: ['REQUESTED', 'CONFIRMED', 'PENDING', 'RESCHEDULED'] },
        },
      }),
      this.prisma.tourPlan.count({
        where: {
          userId,
          deletedAt: null,
          status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] },
          planMonth: { gte: monthStart },
        },
      }),
      this.prisma.leaveRequest.count({ where: { userId, deletedAt: null, status: 'PENDING' } }),
      this.prisma.attendanceRegularization.count({
        where: { userId, deletedAt: null, status: 'PENDING' },
      }),
      this.prisma.expenseClaim.count({ where: { userId, deletedAt: null, status: 'PENDING' } }),
    ]);
    return {
      stockItems: stock._count._all,
      stockUnits: stock._sum.qty ?? 0,
      appointments,
      tourPlans,
      leave,
      regularization,
      expense,
    };
  }

  /** Active MRs / Managers visible to a manager (self + sub-tree) or everyone for Admin. */
  public listTeamMembers(userIds?: number[]) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null,
        role: { in: ['MR', 'MANAGER'] },
        ...(userIds ? { id: { in: userIds } } : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        managerId: true,
        mrProfile: { select: { employeeCode: true, designation: true, assignedArea: true } },
      },
      orderBy: { fullName: 'asc' },
    });
  }

  public findManyByIds(ids: number[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, fullName: true, email: true, role: true },
    });
  }
}
