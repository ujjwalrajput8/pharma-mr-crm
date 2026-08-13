import { z } from 'zod';

export const setManagerPermissionsSchema = z.object({
  permissions: z.array(z.string().min(1)).min(1, 'Select at least one permission'),
});

export type SetManagerPermissionsDto = z.infer<typeof setManagerPermissionsSchema>;
