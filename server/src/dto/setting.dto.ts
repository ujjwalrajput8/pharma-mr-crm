import { z } from 'zod';

export const listSettingsQuerySchema = z.object({
  group: z.string().max(50).optional(),
});

export const upsertSettingSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i, 'Invalid setting key'),
  value: z.string().max(5000),
  group: z.string().min(1).max(50).default('general'),
});

export type ListSettingsQueryDto = z.infer<typeof listSettingsQuerySchema>;
export type UpsertSettingDto = z.infer<typeof upsertSettingSchema>;
