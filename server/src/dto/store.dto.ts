import { z } from 'zod';
import { RecordStatuses } from '../constants';

const STORE_TYPES = ['CHEMIST', 'STOCKIST'] as const;

export const createStoreSchema = z.object({
  name: z.string().min(2).max(150),
  type: z.enum(STORE_TYPES).optional(),
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

// The Stores page sorts and searches in the browser, so it asks for everything (B-C1).
export const listStoresQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  search: z.string().optional(),
  type: z.enum(STORE_TYPES).optional(),
});

/** Give chemists / stockists to one MR (null = off their MR). A move needs confirmMove. */
export const assignStoresSchema = z
  .object({
    storeIds: z.array(z.number().int().positive()).min(1).max(500),
    mrId: z.number().int().positive().nullable(),
    confirmMove: z.boolean().optional(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const myStoresQuerySchema = z.object({ type: z.enum(STORE_TYPES).optional() });

export type CreateStoreDto = z.infer<typeof createStoreSchema>;
export type UpdateStoreDto = z.infer<typeof updateStoreSchema>;
export type ListStoresQueryDto = z.infer<typeof listStoresQuerySchema>;
export type AssignStoresDto = z.infer<typeof assignStoresSchema>;
export type MyStoresQueryDto = z.infer<typeof myStoresQuerySchema>;
