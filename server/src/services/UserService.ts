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
import { Prisma } from '../../generated/prisma/client';

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: AppRole;
  status: string;
  employeeCode: string | null;
  address: string | null;
  joiningDate: string | null;
  assignedArea: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

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
      role: query.role ?? AppRoles.MR,
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

  public async getById(id: string): Promise<PublicUser> {
    const user = await this.requireMr(id);
    return this.toPublic(user);
  }

  public async createMr(dto: CreateMrDto, actorId: string): Promise<PublicUser> {
    const existing = await this.users.findByEmail(dto.email.toLowerCase());
    if (existing) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await this.passwords.hash(dto.password);

    try {
      const user = await this.users.createWithProfile({
        user: {
          email: dto.email.toLowerCase(),
          fullName: dto.fullName,
          phone: dto.phone,
          passwordHash,
          role: AppRoles.MR,
          status: UserStatuses.ACTIVE,
          createdBy: actorId,
          updatedBy: actorId,
        },
        profile: {
          employeeCode: dto.employeeCode,
          address: dto.address,
          joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null,
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

  public async updateMr(id: string, dto: UpdateMrDto, actorId: string): Promise<PublicUser> {
    await this.requireMr(id);

    if (dto.email) {
      const existing = await this.users.findByEmail(dto.email.toLowerCase());
      if (existing && existing.id !== id) {
        throw new ConflictError('A user with this email already exists');
      }
    }

    const user = await this.users.update(id, {
      ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
      ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
      ...(dto.status ? { status: dto.status } : {}),
      updatedBy: actorId,
      mrProfile: {
        update: {
          ...(dto.employeeCode !== undefined ? { employeeCode: dto.employeeCode } : {}),
          ...(dto.address !== undefined ? { address: dto.address } : {}),
          ...(dto.assignedArea !== undefined ? { assignedArea: dto.assignedArea } : {}),
          ...(dto.joiningDate !== undefined
            ? { joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : null }
            : {}),
          updatedBy: actorId,
        },
      },
    });

    if (dto.status === UserStatuses.INACTIVE) {
      await this.refreshTokens.revokeAllForUser(id);
    }

    return this.toPublic(user);
  }

  public async setStatus(
    id: string,
    status: typeof UserStatuses.ACTIVE | typeof UserStatuses.INACTIVE,
    actorId: string,
  ): Promise<PublicUser> {
    return this.updateMr(id, { status }, actorId);
  }

  public async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actorId: string,
  ): Promise<PublicUser> {
    await this.requireMr(id);
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.update(id, { passwordHash, updatedBy: actorId });
    await this.refreshTokens.revokeAllForUser(id);
    return this.toPublic(user);
  }

  public async deleteMr(id: string, actorId: string): Promise<void> {
    await this.requireMr(id);
    if (id === actorId) {
      throw new BadRequestError('You cannot delete your own account');
    }
    await this.users.softDelete(id, actorId);
    await this.refreshTokens.revokeAllForUser(id);
  }

  private async requireMr(id: string): Promise<UserWithProfile> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== AppRoles.MR) {
      throw new ForbiddenError('Only Medical Representative accounts can be managed here');
    }
    return user;
  }

  private toPublic(user: UserWithProfile): PublicUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role as AppRole,
      status: user.status,
      employeeCode: user.mrProfile?.employeeCode ?? null,
      address: user.mrProfile?.address ?? null,
      joiningDate: user.mrProfile?.joiningDate
        ? user.mrProfile.joiningDate.toISOString().slice(0, 10)
        : null,
      assignedArea: user.mrProfile?.assignedArea ?? null,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
