import { AppRoles, UserStatuses, type AppRole } from '../constants';
import type {
  CreateMrDto,
  ListUsersQueryDto,
  ResetPasswordDto,
  UpdateMrDto,
} from '../dto/user.dto';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../errors/AppError';
import { UserRepository, type UserWithProfile } from '../repositories/UserRepository';
import { RefreshTokenRepository } from '../repositories/RefreshTokenRepository';
import { PasswordService } from './PasswordService';
import { formatDateOnly, parseDateOnly } from '../utils/datetime';
import { Prisma } from '@prisma/client';

export interface PublicUser {
  id: number;
  email: string;
  fullName: string;
  phone: string | null;
  role: AppRole;
  status: string;
  managerId: number | null;
  managerName: string | null;
  territoryId: number | null;
  employeeCode: string | null;
  designation: string | null;
  address: string | null;
  joiningDate: string | null;
  assignedArea: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UserService — Admin management of field-force accounts (MR and Manager).
 * Admin accounts themselves are provisioned by the seed, not through this API.
 */
export class UserService {
  private static instance: UserService | null = null;

  private constructor(
    private readonly users = UserRepository.getInstance(),
    private readonly refreshTokens = RefreshTokenRepository.getInstance(),
    private readonly passwords = PasswordService.getInstance(),
  ) {}

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  public async list(query: ListUsersQueryDto) {
    const { items, total } = await this.users.list({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      // No role filter → MRs and Managers together (Admin accounts stay hidden).
      role: query.role,
      roles: query.role ? undefined : [AppRoles.MR, AppRoles.MANAGER],
    });

    return {
      items: items.map((user) => this.toPublic(user)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async getById(id: number): Promise<PublicUser> {
    const user = await this.requireFieldUser(id);
    return this.toPublic(user);
  }

  public async createMr(dto: CreateMrDto, actorId: number): Promise<PublicUser> {
    const existing = await this.users.findByEmail(dto.email.toLowerCase());
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    if (dto.managerId) {
      await this.assertValidManager(dto.managerId, dto.role);
    }

    const passwordHash = await this.passwords.hash(dto.password);

    try {
      const user = await this.users.createWithProfile({
        user: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash,
          role: dto.role,
          status: UserStatuses.ACTIVE,
          ...(dto.managerId ? { manager: { connect: { id: dto.managerId } } } : {}),
          ...(dto.territoryId ? { territory: { connect: { id: dto.territoryId } } } : {}),
          createdBy: actorId,
          updatedBy: actorId,
        },
        profile: {
          employeeCode: dto.employeeCode,
          designation: dto.designation,
          address: dto.address,
          joiningDate: dto.joiningDate ? parseDateOnly(dto.joiningDate) : null,
          assignedArea: dto.assignedArea,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      return this.toPublic(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Employee code or email already exists');
      }
      throw error;
    }
  }

  public async updateMr(id: number, dto: UpdateMrDto, actorId: number): Promise<PublicUser> {
    const current = await this.requireFieldUser(id);

    if (dto.email) {
      const existing = await this.users.findByEmail(dto.email.toLowerCase());
      if (existing && existing.id !== id) {
        throw new ConflictError('A user with this email already exists');
      }
    }

    if (dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestError('A user cannot report to themselves');
      }
      await this.assertValidManager(dto.managerId, dto.role ?? (current.role as AppRole));
      await this.assertNoReportingCycle(id, dto.managerId);
    }

    // Demoting a Manager who still has reports would orphan them.
    if (dto.role === AppRoles.MR && current.role === AppRoles.MANAGER) {
      const reports = await this.users.listReportIds(id);
      if (reports.length > 0) {
        throw new BadRequestError(
          `${reports.length} employee(s) still report to this manager — reassign them first.`,
        );
      }
    }

    try {
      const user = await this.users.update(id, {
        ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(dto.managerId !== undefined
          ? dto.managerId
            ? { manager: { connect: { id: dto.managerId } } }
            : { manager: { disconnect: true } }
          : {}),
        ...(dto.territoryId !== undefined
          ? dto.territoryId
            ? { territory: { connect: { id: dto.territoryId } } }
            : { territory: { disconnect: true } }
          : {}),
        updatedBy: actorId,
        mrProfile: {
          update: {
            ...(dto.employeeCode !== undefined ? { employeeCode: dto.employeeCode } : {}),
            ...(dto.designation !== undefined ? { designation: dto.designation } : {}),
            ...(dto.address !== undefined ? { address: dto.address } : {}),
            ...(dto.assignedArea !== undefined ? { assignedArea: dto.assignedArea } : {}),
            ...(dto.joiningDate !== undefined
              ? { joiningDate: dto.joiningDate ? parseDateOnly(dto.joiningDate) : null }
              : {}),
            updatedBy: actorId,
          },
        },
      });

      if (dto.status === UserStatuses.INACTIVE) {
        await this.refreshTokens.revokeAllForUser(id);
      }

      return this.toPublic(user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Employee code or email already exists');
      }
      throw error;
    }
  }

  public async setStatus(
    id: number,
    status: typeof UserStatuses.ACTIVE | typeof UserStatuses.INACTIVE,
    actorId: number,
  ): Promise<PublicUser> {
    return this.updateMr(id, { status }, actorId);
  }

  public async resetPassword(
    id: number,
    dto: ResetPasswordDto,
    actorId: number,
  ): Promise<PublicUser> {
    await this.requireFieldUser(id);
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.update(id, { passwordHash, updatedBy: actorId });
    await this.refreshTokens.revokeAllForUser(id);
    return this.toPublic(user);
  }

  public async deleteMr(id: number, actorId: number): Promise<void> {
    await this.requireFieldUser(id);
    if (id === actorId) {
      throw new BadRequestError('You cannot delete your own account');
    }
    const reports = await this.users.listReportIds(id);
    if (reports.length > 0) {
      throw new BadRequestError(
        `${reports.length} employee(s) still report to this account — reassign them first.`,
      );
    }
    await this.users.softDelete(id, actorId);
    await this.refreshTokens.revokeAllForUser(id);
  }

  /** Managers available as a reporting parent, for the create/edit form. */
  public async listManagerOptions() {
    const { items } = await this.users.list({
      page: 1,
      limit: 200,
      role: AppRoles.MANAGER,
      status: UserStatuses.ACTIVE,
    });
    return items.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      designation: user.mrProfile?.designation ?? null,
    }));
  }

  private async requireFieldUser(id: number): Promise<UserWithProfile> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (user.role === AppRoles.ADMIN) {
      throw new ForbiddenError('Administrator accounts cannot be managed here');
    }
    return user;
  }

  private async assertValidManager(managerId: number, subordinateRole: AppRole): Promise<void> {
    const manager = await this.users.findById(managerId);
    if (!manager || manager.deletedAt) throw new NotFoundError('Reporting manager not found');
    if (manager.role === AppRoles.MR) {
      throw new BadRequestError('An MR cannot be a reporting manager');
    }
    if (subordinateRole === AppRoles.MANAGER && manager.role !== AppRoles.MANAGER) {
      // Managers report to another Manager (ASM → RSM) or to nobody.
      throw new BadRequestError('A Manager can only report to another Manager');
    }
  }

  /** Guards against A → B → A reporting loops, which would break every team query. */
  private async assertNoReportingCycle(userId: number, newManagerId: number): Promise<void> {
    const descendants = await this.users.listDescendantIds(userId);
    if (descendants.includes(newManagerId)) {
      throw new BadRequestError(
        'That manager already reports to this user — pick someone outside their team.',
      );
    }
  }

  private toPublic(user: UserWithProfile): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role as AppRole,
      status: user.status,
      managerId: user.managerId,
      managerName: user.manager?.fullName ?? null,
      territoryId: user.territoryId,
      employeeCode: user.mrProfile?.employeeCode ?? null,
      designation: user.mrProfile?.designation ?? null,
      address: user.mrProfile?.address ?? null,
      joiningDate: user.mrProfile?.joiningDate
        ? formatDateOnly(user.mrProfile.joiningDate)
        : null,
      assignedArea: user.mrProfile?.assignedArea ?? null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
