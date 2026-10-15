import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type TerritoryType = 'STATE' | 'DISTRICT' | 'HQ' | 'BEAT';

/** The level a new child of each type gets. */
export const TERRITORY_CHILD_OF: Record<TerritoryType, TerritoryType | null> = {
  STATE: 'DISTRICT',
  DISTRICT: 'HQ',
  HQ: 'BEAT',
  BEAT: null,
};

export const TERRITORY_TYPE_LABEL: Record<TerritoryType, string> = {
  STATE: 'State',
  DISTRICT: 'District',
  HQ: 'HQ',
  BEAT: 'Beat',
};

export interface Territory {
  id: number;
  name: string;
  type: TerritoryType;
  code: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number | null;
  parentId: number | null;
  parent: { id: number; name: string; type: string } | null;
  counts: { children: number; users: number; doctors: number };
}

export interface TerritoryTreeNode extends Territory {
  children: TerritoryTreeNode[];
}

export interface TerritoryPayload {
  name: string;
  type: TerritoryType;
  parentId?: number | null;
  code?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
  latitude?: number | null;
  longitude?: number | null;
  geofenceRadiusM?: number | null;
}

export const territoriesApi = {
  async list(
    params: {
      type?: TerritoryType;
      parentId?: number;
      search?: string;
      includeInactive?: boolean;
    } = {},
  ): Promise<Territory[]> {
    const { data } = await api.get<ApiSuccess<Territory[]>>('/territories', { params });
    return data.data;
  },
  async tree(includeInactive = false): Promise<TerritoryTreeNode[]> {
    const { data } = await api.get<ApiSuccess<TerritoryTreeNode[]>>('/territories/tree', {
      params: includeInactive ? { includeInactive: true } : undefined,
    });
    return data.data;
  },
  async create(payload: TerritoryPayload): Promise<Territory> {
    const { data } = await api.post<ApiSuccess<Territory>>('/territories', payload);
    return data.data;
  },
  async update(id: number, payload: Partial<TerritoryPayload>): Promise<Territory> {
    const { data } = await api.patch<ApiSuccess<Territory>>(`/territories/${id}`, payload);
    return data.data;
  },
  async remove(id: number): Promise<void> {
    await api.delete(`/territories/${id}`);
  },
};
