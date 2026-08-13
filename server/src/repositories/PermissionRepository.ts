import type { Role } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

export class PermissionRepository {
  private static instance: PermissionRepository | null = null;
  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): PermissionRepository {
    if (!PermissionRepository.instance) {
      PermissionRepository.instance = new PermissionRepository();
    }
    return PermissionRepository.instance;
  }

  public listRolePermissions(role: Role): Promise<string[]> {
    return this.prisma.rolePermission
      .findMany({ where: { role }, select: { permission: true } })
      .then((rows) => rows.map((r) => r.permission));
  }

  public listUserPermissions(userId: number): Promise<string[]> {
    return this.prisma.userPermission
      .findMany({
        where: { userId, allowed: true },
        select: { permission: true },
      })
      .then((rows) => rows.map((r) => r.permission));
  }

  public async replaceUserPermissions(
    userId: number,
    permissions: string[],
    actorId: number,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });
      if (permissions.length > 0) {
        await tx.userPermission.createMany({
          data: permissions.map((permission) => ({
            userId,
            permission,
            allowed: true,
            createdBy: actorId,
            updatedBy: actorId,
          })),
        });
      }
      await tx.user.update({
        where: { id: userId },
        data: {
          permissionsCustomized: true,
          updatedBy: actorId,
        },
      });
    });
  }

  public async resetUserPermissions(userId: number, actorId: number): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.userPermission.deleteMany({ where: { userId } });
      await tx.user.update({
        where: { id: userId },
        data: {
          permissionsCustomized: false,
          updatedBy: actorId,
        },
      });
    });
  }

  public async upsertRoleDefaults(role: Role, permissions: string[]): Promise<void> {
    for (const permission of permissions) {
      await this.prisma.rolePermission.upsert({
        where: { role_permission: { role, permission } },
        create: { role, permission },
        update: {},
      });
    }
  }
}
