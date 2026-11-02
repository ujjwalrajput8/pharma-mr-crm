import { z } from 'zod';
import { idSchema } from './common.dto';
import { DoctorAreaTypes, RecordStatuses } from '../constants';

/** `null` clears the column on update; `undefined` leaves it alone. */
const optionalText = (max: number) => z.string().max(max).nullable().optional();
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .nullable()
  .optional();

/**
 * Mirrors the MSL sheet's columns, in the sheet's order — except MSL No, which
 * the database assigns (JL-001 …) and nobody can set or change.
 */
export const createDoctorSchema = z.object({
  area: optionalText(120),
  areaType: z
    .enum([DoctorAreaTypes.HQ, DoctorAreaTypes.EX, DoctorAreaTypes.OS])
    .nullable()
    .optional(),
  fullName: z.string().min(2).max(150),
  phone: z.string().min(7).max(20).nullable().optional(),
  mslClass: optionalText(20),
  specialization: optionalText(120),
  address: optionalText(500),
  email: z.string().email().nullable().optional(),
  birthday: optionalDate,
  anniversary: optionalDate,
  status: z.enum([RecordStatuses.ACTIVE, RecordStatuses.INACTIVE]).optional(),
  mrId: idSchema.optional(),
});

export const updateDoctorSchema = createDoctorSchema.partial();

export const listDoctorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // Screens filter and page client-side, so they ask for the whole list at once.
  limit: z.coerce.number().int().positive().max(5000).default(20),
  search: z.string().optional(),
});

export const assignMrSchema = z.object({
  mrId: idSchema,
});

export const DOCTOR_IMPORT_MAX_ROWS = 2000;

/** Adds doctors from an MSL spreadsheet; same name + area as an existing doctor is skipped. */
export const importDoctorsSchema = z.object({
  fileName: z.string().max(255).optional(),
  rows: z
    .array(
      z.object({
        /** Spreadsheet row number, echoed back so errors point at the right line. */
        rowNumber: z.number().int().positive(),
        values: z.record(z.string(), z.unknown()),
      }),
    )
    .min(1, 'The file has no data rows')
    .max(DOCTOR_IMPORT_MAX_ROWS, `Import at most ${DOCTOR_IMPORT_MAX_ROWS} rows at a time`),
});

export type CreateDoctorDto = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorDto = z.infer<typeof updateDoctorSchema>;
export type ListDoctorsQueryDto = z.infer<typeof listDoctorsQuerySchema>;
export type AssignMrDto = z.infer<typeof assignMrSchema>;
export type ImportDoctorsDto = z.infer<typeof importDoctorsSchema>;
