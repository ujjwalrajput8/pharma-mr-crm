import { z } from 'zod';
import { idSchema } from './common.dto';
import { createDoctorSchema } from './doctor.dto';
import { VISIT_PARTIES } from './visit.dto';

/** ADD a doctor: the MSL sheet's fields an MR can fill (MSL No is given on approval). */
export const mslDoctorDetailsSchema = createDoctorSchema
  .pick({ fullName: true, specialization: true, mslClass: true, phone: true, email: true, area: true, areaType: true, address: true })
  .strict();

/** ADD a chemist / stockist. */
export const mslStoreDetailsSchema = z
  .object({
    name: z.string().trim().min(2).max(150),
    ownerName: z.string().max(120).optional(),
    phone: z.string().min(7).max(20).optional(),
    city: z.string().max(100).optional(),
    addressLine1: z.string().max(200).optional(),
    gstNumber: z.string().max(30).optional(),
    drugLicenseNumber: z.string().max(60).optional(),
  })
  .strict();

/**
 * POST /msl-requests — an MR asks to add someone to their MSL list or take one off.
 * ADD carries `details`; REMOVE names the doctor (doctorId) or store (storeId).
 */
export const createMslRequestSchema = z
  .object({
    action: z.enum(['ADD', 'REMOVE']),
    party: z.enum(VISIT_PARTIES),
    doctorId: idSchema.optional(),
    storeId: idSchema.optional(),
    details: z.record(z.string(), z.unknown()).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === 'ADD') {
      const schema = value.party === 'DOCTOR' ? mslDoctorDetailsSchema : mslStoreDetailsSchema;
      const parsed = schema.safeParse(value.details ?? {});
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue({ code: 'custom', path: ['details', ...issue.path], message: issue.message });
        }
      }
      return;
    }
    if (value.party === 'DOCTOR' && !value.doctorId) {
      ctx.addIssue({ code: 'custom', path: ['doctorId'], message: 'Choose the doctor to take off your list' });
    }
    if (value.party !== 'DOCTOR' && !value.storeId) {
      ctx.addIssue({ code: 'custom', path: ['storeId'], message: 'Choose the chemist / stockist to take off your list' });
    }
    if ((value.reason ?? '').length < 3) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Say why it should come off your list' });
    }
  });

/** POST /msl-requests/:id/decide — Manager (own team) or Admin. A rejection says why. */
export const decideMslRequestSchema = z
  .object({
    action: z.enum(['APPROVE', 'REJECT']),
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action === 'REJECT' && (value.note ?? '').length < 3) {
      ctx.addIssue({ code: 'custom', path: ['note'], message: 'Say why it is rejected' });
    }
  });

export const listMslRequestsQuerySchema = z.object({
  /** mine = the MR's own; team = what a Manager / Admin decides. */
  scope: z.enum(['mine', 'team']).default('mine'),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  party: z.enum(VISIT_PARTIES).optional(),
});

export type CreateMslRequestDto = z.infer<typeof createMslRequestSchema>;
export type DecideMslRequestDto = z.infer<typeof decideMslRequestSchema>;
export type ListMslRequestsQueryDto = z.infer<typeof listMslRequestsQuerySchema>;
export type MslDoctorDetails = z.infer<typeof mslDoctorDetailsSchema>;
export type MslStoreDetails = z.infer<typeof mslStoreDetailsSchema>;
