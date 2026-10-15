import type { Prisma } from '@prisma/client';
import {
  TERRITORY_PARENT_OF,
  TERRITORY_TYPES,
  type CreateTerritoryDto,
  type ListTerritoriesQueryDto,
  type TerritoryTypeValue,
  type UpdateTerritoryDto,
} from '../dto/territory.dto';
import { BadRequestError, ConflictError, NotFoundError } from '../errors/AppError';
import { PrismaService } from '../prisma/PrismaService';
import { AuditService } from './AuditService';
import type { AuthUser } from '../types/auth.types';

export interface PublicTerritory {
  id: number;
  name: string;
  type: string;
  code: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number | null;
  parentId: number | null;
  parent: { id: number; name: string; type: string } | null;
  counts: { children: number; users: number; doctors: number };
}

export interface TerritoryTreeNode extends PublicTerritory {
  children: TerritoryTreeNode[];
}

const territoryInclude = {
  parent: { select: { id: true, name: true, type: true } },
  _count: {
    select: {
      children: { where: { deletedAt: null } },
      users: { where: { deletedAt: null } },
      doctors: { where: { deletedAt: null } },
    },
  },
} satisfies Prisma.TerritoryInclude;

type TerritoryRow = Prisma.TerritoryGetPayload<{ include: typeof territoryInclude }>;

/** Sort key so a flat list reads STATE → DISTRICT → HQ → BEAT. */
const TYPE_ORDER: Record<string, number> = Object.fromEntries(
  TERRITORY_TYPES.map((type, index) => [type, index]),
);

/**
 * TerritoryService — geography master (STATE → DISTRICT → HQ → BEAT).
 *
 * The tree is strict: every level's parent must be exactly the level above,
 * because beats drive the tour plan and HQ/beat centres drive the attendance
 * geo-fence. Deletion is soft and blocked while anything still hangs off a node.
 */
export class TerritoryService {
  private static instance: TerritoryService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly audits = AuditService.getInstance(),
  ) {}

  public static getInstance(): TerritoryService {
    if (!TerritoryService.instance) TerritoryService.instance = new TerritoryService();
    return TerritoryService.instance;
  }

  public async list(query: ListTerritoriesQueryDto): Promise<PublicTerritory[]> {
    const rows = await this.prisma.territory.findMany({
      where: {
        deletedAt: null,
        ...(query.includeInactive ? {} : { status: 'ACTIVE' }),
        ...(query.type ? { type: query.type } : {}),
        ...(query.parentId ? { parentId: query.parentId } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { code: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: territoryInclude,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return rows
      .map((row) => this.toPublic(row))
      .sort(
        (a, b) =>
          (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99) ||
          a.name.localeCompare(b.name),
      );
  }

  /** Nested STATE → DISTRICT → HQ → BEAT tree (active and inactive alike are opt-in). */
  public async tree(includeInactive = false): Promise<TerritoryTreeNode[]> {
    const rows = await this.prisma.territory.findMany({
      where: { deletedAt: null, ...(includeInactive ? {} : { status: 'ACTIVE' }) },
      include: territoryInclude,
      orderBy: [{ name: 'asc' }],
    });

    const nodes = new Map<number, TerritoryTreeNode>(
      rows.map((row) => [row.id, { ...this.toPublic(row), children: [] }]),
    );
    const roots: TerritoryTreeNode[] = [];
    for (const row of rows) {
      const node = nodes.get(row.id)!;
      const parent = row.parentId ? nodes.get(row.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }

    const sortLevel = (list: TerritoryTreeNode[]): void => {
      list.sort(
        (a, b) =>
          (TYPE_ORDER[a.type] ?? 99) - (TYPE_ORDER[b.type] ?? 99) ||
          a.name.localeCompare(b.name),
      );
      for (const node of list) sortLevel(node.children);
    };
    sortLevel(roots);
    return roots;
  }

  public async create(dto: CreateTerritoryDto, actor: AuthUser): Promise<PublicTerritory> {
    await this.assertHierarchy(dto.type, dto.parentId ?? null);

    const row = await this.prisma.territory.create({
      data: {
        name: dto.name,
        type: dto.type,
        code: dto.code ?? null,
        status: dto.status,
        latitude: dto.latitude ?? null,
        longitude: dto.longitude ?? null,
        geofenceRadiusM: dto.geofenceRadiusM ?? null,
        ...(dto.parentId ? { parent: { connect: { id: dto.parentId } } } : {}),
        createdBy: actor.id,
        updatedBy: actor.id,
      },
      include: territoryInclude,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'CREATE_TERRITORY',
      entity: 'Territory',
      entityId: String(row.id),
      metadata: { name: row.name, type: row.type, parentId: row.parentId },
    });

    return this.toPublic(row);
  }

  public async update(
    id: number,
    dto: UpdateTerritoryDto,
    actor: AuthUser,
  ): Promise<PublicTerritory> {
    const existing = await this.prisma.territory.findFirst({
      where: { id, deletedAt: null },
      include: { _count: { select: { children: { where: { deletedAt: null } } } } },
    });
    if (!existing) throw new NotFoundError('Territory not found');

    const nextType = (dto.type ?? existing.type) as TerritoryTypeValue;
    const nextParentId = dto.parentId !== undefined ? dto.parentId : existing.parentId;

    if (dto.type && dto.type !== existing.type && existing._count.children > 0) {
      throw new ConflictError(
        'This territory has child territories — move or delete them before changing its level.',
      );
    }
    if (dto.type !== undefined || dto.parentId !== undefined) {
      if (nextParentId === id) throw new BadRequestError('A territory cannot be its own parent');
      await this.assertHierarchy(nextType, nextParentId ?? null);
    }

    const row = await this.prisma.territory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.code !== undefined ? { code: dto.code } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        ...(dto.geofenceRadiusM !== undefined ? { geofenceRadiusM: dto.geofenceRadiusM } : {}),
        ...(dto.parentId !== undefined
          ? dto.parentId
            ? { parent: { connect: { id: dto.parentId } } }
            : { parent: { disconnect: true } }
          : {}),
        updatedBy: actor.id,
      },
      include: territoryInclude,
    });

    await this.audits.log({
      userId: actor.id,
      action: 'UPDATE_TERRITORY',
      entity: 'Territory',
      entityId: String(row.id),
      metadata: { name: row.name, type: row.type, changes: dto },
    });

    return this.toPublic(row);
  }

  /** Soft delete — refused (409) while children / users / doctors still point here. */
  public async remove(id: number, actor: AuthUser): Promise<void> {
    const existing = await this.prisma.territory.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            children: { where: { deletedAt: null } },
            users: { where: { deletedAt: null } },
            doctors: { where: { deletedAt: null } },
          },
        },
      },
    });
    if (!existing) throw new NotFoundError('Territory not found');

    const blockers: string[] = [];
    if (existing._count.children > 0) blockers.push(`${existing._count.children} child territory(ies)`);
    if (existing._count.users > 0) blockers.push(`${existing._count.users} employee(s)`);
    if (existing._count.doctors > 0) blockers.push(`${existing._count.doctors} doctor(s)`);
    if (blockers.length > 0) {
      throw new ConflictError(
        `Cannot delete ${existing.name} — it still has ${blockers.join(', ')}. Reassign or delete them first.`,
      );
    }

    await this.prisma.territory.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE', updatedBy: actor.id },
    });

    await this.audits.log({
      userId: actor.id,
      action: 'DELETE_TERRITORY',
      entity: 'Territory',
      entityId: String(id),
      metadata: { name: existing.name, type: existing.type },
    });
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  /** STATE is a root; every other level must sit exactly one level below its parent. */
  private async assertHierarchy(
    type: TerritoryTypeValue,
    parentId: number | null,
  ): Promise<void> {
    const requiredParentType = TERRITORY_PARENT_OF[type];

    if (!requiredParentType) {
      if (parentId) throw new BadRequestError('A STATE is a top-level territory — remove the parent');
      return;
    }
    if (!parentId) {
      throw new BadRequestError(`A ${type} must sit under a ${requiredParentType}`);
    }
    const parent = await this.prisma.territory.findFirst({
      where: { id: parentId, deletedAt: null },
      select: { id: true, name: true, type: true },
    });
    if (!parent) throw new NotFoundError('Parent territory not found');
    if (parent.type !== requiredParentType) {
      throw new BadRequestError(
        `A ${type} must sit under a ${requiredParentType} — ${parent.name} is a ${parent.type}`,
      );
    }
  }

  private toPublic(row: TerritoryRow): PublicTerritory {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      code: row.code,
      status: row.status,
      latitude: row.latitude,
      longitude: row.longitude,
      geofenceRadiusM: row.geofenceRadiusM,
      parentId: row.parentId,
      parent: row.parent ? { id: row.parent.id, name: row.parent.name, type: row.parent.type } : null,
      counts: {
        children: row._count.children,
        users: row._count.users,
        doctors: row._count.doctors,
      },
    };
  }
}
