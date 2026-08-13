import type { Prisma, User } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';
import { AppRoles } from '../constants';

export interface UserListParams {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  role?: string;
}

export type UserWithProfile = User & {
  mrProfile: {
    id: number;
    employeeCode: string;
    address: string | null;
    joiningDate: Date | null;
    assignedArea: string | null;
  } | null;
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
      include: { mrProfile: true },
    });
  }

  public findById(id: number): Promise<UserWithProfile | null> {
    return this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      include: { mrProfile: true },
    });
  }

  public createWithProfile(input: {
    user: Prisma.UserCreateInput;
    profile: {
      employeeCode: string;
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
      include: { mrProfile: true },
    });
  }

  public create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  public update(id: number, data: Prisma.UserUpdateInput): Promise<UserWithProfile> {
    return this.prisma.user.update({
      where: { id },
      data,
      include: { mrProfile: true },
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
      ...(params.role ? { role: params.role as Prisma.EnumRoleFilter['equals'] } : { role: AppRoles.MR }),
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
        include: { mrProfile: true },
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

  public findManyByIds(ids: number[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, fullName: true, email: true, role: true },
    });
  }
}
