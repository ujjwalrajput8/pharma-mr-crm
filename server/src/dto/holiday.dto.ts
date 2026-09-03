import { z } from 'zod';
import { HolidayTypes, RecordStatuses } from '../constants';
import { idSchema } from './common.dto';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const createHolidaySchema = z.object({
  holidayDate: dateOnly,
  name: z.string().min(2).max(120),
  type: z
    .enum([
      HolidayTypes.NATIONAL,
      HolidayTypes.FESTIVAL,
      HolidayTypes.REGIONAL,
      HolidayTypes.COMPANY,
      HolidayTypes.WEEKLY_OFF,
    ])
    .default(HolidayTypes.NATIONAL),
  territoryId: idSchema.optional(),
  isOptional: z.coerce.boolean().default(false),
  description: z.string().max(500).optional(),
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).default(RecordStatuses.ACTIVE),
});

export const updateHolidaySchema = createHolidaySchema.partial();

export const listHolidaysQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
  territoryId: idSchema.optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export type CreateHolidayDto = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayDto = z.infer<typeof updateHolidaySchema>;
export type ListHolidaysQueryDto = z.infer<typeof listHolidaysQuerySchema>;
