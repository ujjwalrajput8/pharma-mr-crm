import type { Role } from '@prisma/client';
import { AppRoles } from '../constants';
import {
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_MANAGER_PERMISSIONS,
  DEFAULT_MR_PERMISSIONS,
  MR_ACCESS_ITEMS,
  PERMISSION_CATALOG,
  type PermissionKey,
} from '../constants/permissions';
import { BadRequestError, ForbiddenError, NotFoundError } from '../errors/AppError';
import { PermissionRepository } from '../repositories/PermissionRepository';
import { SettingRepository } from '../repositories/SettingRepository';
import { UserRepository } from '../repositories/UserRepository';
import type { AuthUser } from '../types/auth.types';
import { AuditService } from './AuditService';

const CATALOG_KEYS = new Set(PERMISSION_CATALOG.map((p) => p.key));
/** Admin's MR menu switches live in settings — role_permissions is rewritten on every deploy. */
const MR_ACCESS_SETTING = 'access.mr.permissions';
const MR_ACCESS_KEYS = new Set<string>(MR_ACCESS_ITEMS.map((item) => item.key));
/** Every request resolves permissions; the switches are re-read at most this often (and on change). */
const MR_ACCESS_CACHE_MS = 30_000;

/**
 * PermissionService — resolve effective permissions (role defaults or Admin overrides).
 */
export class PermissionService {
  private static instance: PermissionService | null = null;

  private mrAccessCache: { at: number; on: string[] | null } | null = null;

  private constructor(
    private readonly permissions = PermissionRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly settings = SettingRepository.getInstance(),
    private readonly audit = AuditService.getInstance(),
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
    return this.resolveFor(user);
  }

  /** Same as `resolveForUser` when the caller already holds the user row — saves a lookup. */
  public async resolveFor(user: {
    id: number;
    role: Role;
    permissionsCustomized: boolean;
  }): Promise<string[]> {
    if (user.permissionsCustomized) {
      const custom = await this.permissions.listUserPermissions(user.id);
      return this.ensureProfile(custom);
    }

    const fromDb = await this.permissions.listRolePermissions(user.role);
    const base = fromDb.length > 0 ? fromDb : [...this.fallbackDefaults(user.role)];
    return this.ensureProfile(user.role === AppRoles.MR ? await this.withMrAccess(base) : base);
  }

  /** The MR menu switches (Manager & MR Access → MRs) with the role defaults behind them. */
  public async getMrAccess(actor: AuthUser) {
    this.assertAdmin(actor);
    const defaults = (await this.roleDefaults(AppRoles.MR)).filter((key) => MR_ACCESS_KEYS.has(key));
    const on = await this.mrAccessSwitches();
    return {
      items: MR_ACCESS_ITEMS.map((item) => ({ ...item })),
      defaults,
      enabled: on ?? defaults,
      customized: on !== null,
    };
  }

  public async setMrAccess(keys: string[], actor: AuthUser) {
    this.assertAdmin(actor);
    const unique = [...new Set(keys)].sort();
    const unknown = unique.filter((key) => !MR_ACCESS_KEYS.has(key));
    if (unknown.length > 0) throw new BadRequestError(`Not an MR menu switch: ${unknown.join(', ')}`);

    const before = await this.getMrAccess(actor);
    await this.settings.upsert({ key: MR_ACCESS_SETTING, value: JSON.stringify(unique), group: 'access', actorId: actor.id });
    this.mrAccessCache = null;
    await this.audit.log({
      userId: actor.id,
      action: 'MR_ACCESS_UPDATED',
      entity: 'Setting',
      entityId: MR_ACCESS_SETTING,
      before: before.enabled,
      after: unique,
    });
    return this.getMrAccess(actor);
  }

  public async resetMrAccess(actor: AuthUser) {
    this.assertAdmin(actor);
    const before = await this.getMrAccess(actor);
    await this.settings.softDelete(MR_ACCESS_SETTING, actor.id);
    this.mrAccessCache = null;
    const after = await this.getMrAccess(actor);
    await this.audit.log({
      userId: actor.id,
      action: 'MR_ACCESS_RESET',
      entity: 'Setting',
      entityId: MR_ACCESS_SETTING,
      before: before.enabled,
      after: after.enabled,
    });
    return after;
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

  /** Admin's MR switches, or null while MRs follow the role defaults. */
  private async mrAccessSwitches(): Promise<string[] | null> {
    if (this.mrAccessCache && Date.now() - this.mrAccessCache.at < MR_ACCESS_CACHE_MS) {
      return this.mrAccessCache.on;
    }
    const row = await this.settings.findByKey(MR_ACCESS_SETTING);
    let on: string[] | null = null;
    if (row) {
      try {
        const parsed: unknown = JSON.parse(row.value);
        if (Array.isArray(parsed)) on = parsed.filter((key): key is string => typeof key === 'string' && MR_ACCESS_KEYS.has(key));
      } catch {
        on = null; // A hand-edited, broken value falls back to the defaults.
      }
    }
    this.mrAccessCache = { at: Date.now(), on };
    return on;
  }

  /** Only the switchable keys change; every other MR permission stays as the role defaults say. */
  private async withMrAccess(base: string[]): Promise<string[]> {
    const on = await this.mrAccessSwitches();
    if (!on) return base;
    return [...base.filter((key) => !MR_ACCESS_KEYS.has(key)), ...on];
  }

  private ensureProfile(permissions: string[]): string[] {
    const set = new Set(permissions);
    set.add('profile:own');
    set.add('dashboard:view');
    return [...set].sort();
  }

  private assertAdmin(actor: AuthUser): void {
    if (actor.role !== AppRoles.ADMIN) {
      throw new ForbiddenError('Only administrators can manage access');
    }
  }
}
