import { z } from 'zod';

export const setManagerPermissionsSchema = z.object({
  permissions: z.array(z.string().min(1)).min(1, 'Select at least one permission'),
});

export type SetManagerPermissionsDto = z.infer<typeof setManagerPermissionsSchema>;

/** MR menu switches that are on — an empty list leaves MRs with the Dashboard only. */
export const setMrAccessSchema = z.object({
  permissions: z.array(z.string().min(1)).max(50),
});

export type SetMrAccessDto = z.infer<typeof setMrAccessSchema>;
