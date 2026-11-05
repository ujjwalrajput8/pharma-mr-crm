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
import { AuditService } from './AuditService';
import { NotificationService } from './NotificationService';
import { PasswordService } from './PasswordService';
import { formatDateOnly, monthRange, parseDateOnly, todayDateOnly } from '../utils/datetime';
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
    private readonly audits = AuditService.getInstance(),
    private readonly notifications = NotificationService.getInstance(),
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

    // Reporting rules run only when the manager actually changes, so editing a
    // name or phone can never disturb (or be blocked by) an existing reporting line.
    const managerChanges =
      dto.managerId !== undefined && (dto.managerId ?? null) !== (current.managerId ?? null);
    if (managerChanges && dto.managerId) {
      if (dto.managerId === id) {
        throw new BadRequestError('A user cannot report to themselves');
      }
      await this.assertValidManager(dto.managerId, dto.role ?? (current.role as AppRole));
      await this.assertNoReportingCycle(id, dto.managerId);
    }

    // Demoting or deactivating a Manager who still has reports would cut them off:
    // nobody above could see their attendance, leave or visits any more.
    const losesTeam =
      current.role === AppRoles.MANAGER &&
      ((dto.role === AppRoles.MR) || (dto.status === UserStatuses.INACTIVE && current.status !== UserStatuses.INACTIVE));
    if (losesTeam) {
      const reports = await this.users.listReportIds(id);
      if (reports.length > 0) {
        throw new BadRequestError(
          `${reports.length} employee(s) still report to this manager — reassign them first.`,
        );
      }
    }
    if (dto.status === UserStatuses.INACTIVE && current.status !== UserStatuses.INACTIVE) {
      await this.assertNothingPending(id, 'deactivation');
    }

    try {
      const user = await this.users.update(id, {
        ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.role ? { role: dto.role } : {}),
        ...(managerChanges
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

      if (managerChanges) {
        await this.audits.log({
          userId: actorId,
          action: 'REPORTING_MANAGER_CHANGED',
          entity: 'User',
          entityId: String(id),
          metadata: {
            employee: user.fullName,
            before: { managerId: current.managerId, managerName: current.manager?.fullName ?? null },
            after: { managerId: user.managerId, managerName: user.manager?.fullName ?? null },
          },
        });
        if (user.managerId) {
          await this.notifications.create({
            userId: user.managerId,
            kind: 'TEAM_CHANGED',
            title: `${user.fullName} now reports to you`,
            message: 'Their attendance, leave and visits now appear in your team.',
            href: `/employees/${id}`,
            tone: 'neutral',
          });
        }
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
    await this.assertNothingPending(id, 'deletion');
    await this.users.softDelete(id, actorId);
    await this.refreshTokens.revokeAllForUser(id);
  }

  /**
   * Deactivating or deleting an account must not strand stock, visits or requests in
   * its name. Nothing is moved or deleted here — the caller settles or reassigns
   * first. Runs for every role, so turning an MR into a Manager cannot get around it.
   */
  private async assertNothingPending(id: number, action: 'deactivation' | 'deletion') {
    const work = await this.users.pendingWork(id, monthRange(todayDateOnly()).start);
    const parts = [
      work.stockItems > 0 &&
        `Stock: ${work.stockItems} item${work.stockItems === 1 ? '' : 's'} (${work.stockUnits} units)`,
      work.appointments > 0 && `Appointments: ${work.appointments}`,
      work.tourPlans > 0 && `Tour plans: ${work.tourPlans}`,
      work.leave > 0 && `Pending Leave: ${work.leave}`,
      work.regularization > 0 && `Pending Regularization: ${work.regularization}`,
      work.expense > 0 && `Pending Expense: ${work.expense}`,
    ].filter(Boolean);
    if (parts.length > 0) {
      throw new ConflictError(
        `${parts.join(' · ')}. Please settle or reassign before ${action}.`,
        { pendingWork: work },
      );
    }
  }

  /**
   * Managers available as a reporting parent, for the create/edit form. With
   * `forUserId`, that person and everyone below them are left out — choosing one
   * of them would make a loop.
   */
  public async listManagerOptions(forUserId?: number) {
    const { items } = await this.users.list({
      page: 1,
      limit: 200,
      role: AppRoles.MANAGER,
      status: UserStatuses.ACTIVE,
    });
    let excluded = new Set<number>();
    if (forUserId) {
      const links = await this.users.listReportingLinks();
      excluded = new Set([forUserId, ...this.allBelow(forUserId, links)]);
    }
    return items.filter((user) => !excluded.has(user.id)).map((user) => ({
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
    if (manager.role !== AppRoles.MANAGER) {
      // MR → ASM / RSM, ASM → RSM. "No reporting manager" means the person reports to Admin.
      throw new BadRequestError('Pick a Manager — leave it empty to report straight to Admin');
    }
    if (manager.status !== UserStatuses.ACTIVE) {
      throw new BadRequestError(`${manager.fullName} is inactive and cannot take reports`);
    }
    if (subordinateRole === AppRoles.MANAGER && manager.role !== AppRoles.MANAGER) {
      // Managers report to another Manager (ASM → RSM) or to nobody.
      throw new BadRequestError('A Manager can only report to another Manager');
    }
  }

  /**
   * Guards against A → B → A reporting loops, which would break every team query.
   * Walks up from the new manager through every account, active or not.
   */
  private async assertNoReportingCycle(userId: number, newManagerId: number): Promise<void> {
    const links = await this.users.listReportingLinks();
    const managerOf = new Map(links.map((link) => [link.id, link.managerId]));
    let cursor: number | null | undefined = newManagerId;
    for (let hops = 0; cursor && hops <= links.length; hops += 1) {
      if (cursor === userId) {
        throw new BadRequestError(
          'That manager already reports to this user — pick someone outside their team.',
        );
      }
      cursor = managerOf.get(cursor);
    }
  }

  /** Everyone below a person in the reporting tree, active or not. */
  private allBelow(rootId: number, links: Array<{ id: number; managerId: number | null }>): number[] {
    const children = new Map<number, number[]>();
    for (const link of links) {
      if (link.managerId) children.set(link.managerId, [...(children.get(link.managerId) ?? []), link.id]);
    }
    const found = new Set<number>();
    const queue = [...(children.get(rootId) ?? [])];
    while (queue.length) {
      const id = queue.shift()!;
      if (found.has(id) || id === rootId) continue;
      found.add(id);
      queue.push(...(children.get(id) ?? []));
    }
    return [...found];
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
