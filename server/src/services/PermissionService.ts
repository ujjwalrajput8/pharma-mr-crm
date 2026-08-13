import { AppRoles } from '../constants';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_MR_PERMISSIONS,
  PERMISSION_CATALOG,
  type PermissionKey,
} from '../constants/permissions';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PermissionRepository } from '../repositories/PermissionRepository';
import { UserRepository } from '../repositories/UserRepository';
import type { AuthUser } from '../types/auth.types';

const CATALOG_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));

/**
 * PermissionService — resolve effective permissions (role defaults or Admin overrides).
 */
export class PermissionService {
  private static instance: PermissionService | null = null;

  private constructor(
    private readonly permissions = PermissionRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
  ) {}

  public static getInstance(): PermissionService {
    if (!PermissionService.instance) {
      PermissionService.instance = new PermissionService();
    }
    return PermissionService.instance;
  }

  public catalog() {
    return PERMISSION_CATALOG.map((p) => ({ ...p }));
  }

  public async listManagers(actor: AuthUser) {
    this.assertAdmin(actor);
    const { items } = await this.users.list({
      page: 1,
      limit: 100,
      role: AppRoles.MANAGER,
    });

    return Promise.all(
      items.map(async (user) => {
        const effective = await this.resolveForUser(user.id);
        return {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          status: user.status,
          permissionsCustomized: user.permissionsCustomized,
          permissionCount: effective.length,
        };
      }),
    );
  }

  public async resolveForUser(userId: number): Promise<string[]> {
    const user = await this.users.findById(userId);
    if (!user) return [];

    if (user.permissionsCustomized) {
      const custom = await this.permissions.listUserPermissions(userId);
      return this.ensureProfile(custom);
    }

    const fromDb = await this.permissions.listRolePermissions(user.role);
    if (fromDb.length > 0) return this.ensureProfile(fromDb);
    return this.ensureProfile([...this.fallbackDefaults(user.role)]);
  }

  public async getManagerPermissionState(userId: number, actor: AuthUser) {
    this.assertAdmin(actor);
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== AppRoles.MANAGER) {
      throw new BadRequestError('Permissions can only be customized for Manager accounts');
    }

    const defaults = await this.roleDefaults(AppRoles.MANAGER);
    const effective = await this.resolveForUser(userId);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        permissionsCustomized: user.permissionsCustomized,
      },
      catalog: this.catalog(),
      defaults,
      effective,
    };
  }

  public async setManagerPermissions(
    userId: number,
    permissionKeys: string[],
    actor: AuthUser,
  ) {
    this.assertAdmin(actor);
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== AppRoles.MANAGER) {
      throw new BadRequestError('Permissions can only be customized for Manager accounts');
    }

    const unique = [...new Set(permissionKeys)];
    for (const key of unique) {
      if (!CATALOG_KEYS.has(key as PermissionKey)) {
        throw new BadRequestError(`Unknown permission: ${key}`);
      }
    }

    const withProfile = this.ensureProfile(unique);
    await this.permissions.replaceUserPermissions(userId, withProfile, actor.id);
    return this.getManagerPermissionState(userId, actor);
  }

  public async resetManagerPermissions(userId: number, actor: AuthUser) {
    this.assertAdmin(actor);
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== AppRoles.MANAGER) {
      throw new BadRequestError('Only Manager permissions can be reset to defaults');
    }
    await this.permissions.resetUserPermissions(userId, actor.id);
    return this.getManagerPermissionState(userId, actor);
  }

  public async seedRoleDefaults(): Promise<void> {
    await this.permissions.upsertRoleDefaults(AppRoles.ADMIN, [...DEFAULT_ADMIN_PERMISSIONS]);
    await this.permissions.upsertRoleDefaults(AppRoles.MANAGER, [...DEFAULT_MANAGER_PERMISSIONS]);
    await this.permissions.upsertRoleDefaults(AppRoles.MR, [...DEFAULT_MR_PERMISSIONS]);
  }

  private async roleDefaults(role: string): Promise<string[]> {
    const fromDb = await this.permissions.listRolePermissions(role as 'ADMIN' | 'MANAGER' | 'MR');
    if (fromDb.length > 0) return this.ensureProfile(fromDb);
    return this.ensureProfile([...this.fallbackDefaults(role)]);
  }

  private fallbackDefaults(role: string): readonly PermissionKey[] {
    if (role === AppRoles.ADMIN) return DEFAULT_ADMIN_PERMISSIONS;
    if (role === AppRoles.MANAGER) return DEFAULT_MANAGER_PERMISSIONS;
    return DEFAULT_MR_PERMISSIONS;
  }

  private ensureProfile(permissions: string[]): string[] {
    const set = new Set(permissions);
    set.add('profile:own');
    set.add('dashboard:view');
    return [...set].sort();
  }

  private assertAdmin(actor: AuthUser): void {
    if (actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('Only administrators can manage Manager permissions');
    }
  }
}
