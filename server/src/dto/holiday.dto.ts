import { z } from 'zod';
import { HolidayTypes, RecordStatuses } from '../constants';
import { dateOnlySchema, idSchema } from './common.dto';

/** A real calendar day — "2026-02-31" is rejected, not rolled over to March. */
const dateOnly = dateOnlySchema;

export const HOLIDAY_IMPORT_MAX_ROWS = 500;

/**
 * POST /holidays/import — rows as read from the sheet (values keyed by field:
 * date, name, type, optional, description). `dryRun` returns the preview only.
 */
export const importHolidaysSchema = z.object({
  fileName: z.string().max(200).optional(),
  dryRun: z.boolean().default(true),
  rows: z
    .array(
      z.object({
        rowNumber: z.coerce.number().int().positive(),
        values: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1, 'The file has no holiday rows')
    .max(HOLIDAY_IMPORT_MAX_ROWS, `Import at most ${HOLIDAY_IMPORT_MAX_ROWS} holidays at a time`),
});

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
export type ImportHolidaysDto = z.infer<typeof importHolidaysSchema>;
