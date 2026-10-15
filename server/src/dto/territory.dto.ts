import { z } from 'zod';
import { RecordStatuses } from '../constants';
import { idSchema } from './common.dto';

/** Territory levels, top → bottom. Mirrors the Prisma `TerritoryType` enum. */
export const TERRITORY_TYPES = ['STATE', 'DISTRICT', 'HQ', 'BEAT'] as const;
export type TerritoryTypeValue = (typeof TERRITORY_TYPES)[number];

/** The level a territory's parent must be (`null` = must be a root). */
export const TERRITORY_PARENT_OF: Record<TerritoryTypeValue, TerritoryTypeValue | null> = {
  STATE: null,
  DISTRICT: 'STATE',
  HQ: 'DISTRICT',
  BEAT: 'HQ',
};

export const listTerritoriesQuerySchema = z.object({
  type: z.enum(TERRITORY_TYPES).optional(),
  parentId: idSchema.optional(),
  search: z.string().trim().min(1).max(120).optional(),
  includeInactive: z
    .preprocess((value) => value === 'true' || value === true, z.boolean())
    .optional(),
});

const geofenceFields = {
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  /** Metres — attendance check-ins outside this radius get flagged. */
  geofenceRadiusM: z.coerce.number().int().min(10).max(100_000).nullable().optional(),
};

export const createTerritorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  type: z.enum(TERRITORY_TYPES),
  parentId: idSchema.optional(),
  code: z.string().trim().min(1).max(40).optional(),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).default(RecordStatuses.ACTIVE),
  ...geofenceFields,
});

export const updateTerritorySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  type: z.enum(TERRITORY_TYPES).optional(),
  /** `null` moves the territory to the root (STATE only). */
  parentId: idSchema.nullable().optional(),
  code: z.string().trim().max(40).nullable().optional(),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).optional(),
  ...geofenceFields,
});

export type ListTerritoriesQueryDto = z.infer<typeof listTerritoriesQuerySchema>;
export type CreateTerritoryDto = z.infer<typeof createTerritorySchema>;
export type UpdateTerritoryDto = z.infer<typeof updateTerritorySchema>;
