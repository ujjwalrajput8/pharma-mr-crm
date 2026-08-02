import { z } from 'zod';
import { RecordStatuses } from '../constants';

export const createStoreSchema = z.object({
  name: z.string().min(2).max(150),
  ownerName: z.string().max(120).optional(),
  gstNumber: z.string().max(30).optional(),
  drugLicenseNumber: z.string().max(60).optional(),
  email: z.string().email().optional(),
  phone: z.string().min(7).max(20).optional(),
  addressLine1: z.string().max(200).optional(),
  addressLine2: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  pincode: z.string().max(20).optional(),
  notes: z.string().max(2000).optional(),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).optional(),
});

export const updateStoreSchema = createStoreSchema.partial();

export const listStoresQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
});

export type CreateStoreDto = z.infer<typeof createStoreSchema>;
export type UpdateStoreDto = z.infer<typeof updateStoreSchema>;
export type ListStoresQueryDto = z.infer<typeof listStoresQuerySchema>;
