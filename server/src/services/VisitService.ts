import { AppRoles } from '../constants';
import type { ListVisitsQueryDto } from '../dto/visit.dto';
import { ForbiddenError, NotFoundError } from '../errors/AppError';
import { UserRepository } from '../repositories/UserRepository';
import { VisitRepository } from '../repositories/VisitRepository';
import type { AuthUser } from '../types/auth.types';

function formatTime(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * VisitService — Visits are created only via Appointment completion flow.
 */
export class VisitService {
  private static instance: VisitService | null = null;

  private constructor(
    private readonly visits = VisitRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
  ) {}

  public static getInstance(): VisitService {
    if (!VisitService.instance) {
      VisitService.instance = new VisitService();
    }
    return VisitService.instance;
  }

  public async list(query: ListVisitsQueryDto, actor: AuthUser) {
    let mrId: number | undefined;
    let mrIds: number[] | undefined;

    if (actor.role === AppRoles.MR) {
      mrId = actor.id;
    } else if (actor.role === AppRoles.MANAGER) {
      const teamIds = await this.users.listReportIds(actor.id);
      mrIds = [actor.id, ...teamIds];
    }

    const { items, total } = await this.visits.list({
      page: query.page,
      limit: query.limit,
      doctorId: query.doctorId,
      mrId,
      mrIds,
    });

    return {
      items: items.map((item) => this.toPublic(item)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }

  public async remove(id: number, actor: AuthUser) {
    const visit = await this.visits.findById(id);
    if (!visit) throw new NotFoundError('Visit not found');
    if (actor.role === AppRoles.MR && visit.mrId !== actor.id) {
      throw new ForbiddenError('You can only delete your own visits');
    }
    if (actor.role === AppRoles.MANAGER) {
      const teamIds = await this.users.listReportIds(actor.id);
      if (![actor.id, ...teamIds].includes(visit.mrId)) {
        throw new ForbiddenError('You can only delete team visits');
      }
    }
    await this.visits.softDelete(id, actor.id);
  }

  private toPublic(visit: {
    id: number;
      appointmentId?: number | null;
    doctorId: number | null;
    mrId: number;
    visitDate: Date;
    visitTime?: Date | null;
    checkInTime?: Date | null;
    checkOutTime?: Date | null;
    meetingDurationMin?: number | null;
    discussionNotes?: string | null;
    doctorFeedback?: string | null;
    visitOutcome?: string | null;
    remarks: string | null;
    nextFollowUp: Date | null;
    createdAt: Date;
    updatedAt: Date;
    doctor?: { id: number; fullName: string } | null;
    mr?: { id: number; fullName: string; email: string };
    products?: Array<{ notes?: string | null; medicine: { id: number; name: string } }>;
    distributions?: Array<{
      id: number;
      qty: number;
      note: string | null;
      medicine: { id: number; name: string };
      batch: { batchNo: string };
    }>;
  }) {
    return {
      id: visit.id,
      appointmentId: visit.appointmentId ?? null,
      doctorId: visit.doctorId,
      mrId: visit.mrId,
      visitDate: visit.visitDate.toISOString().slice(0, 10),
      visitTime: visit.visitTime ? formatTime(visit.visitTime) : null,
      checkInTime: visit.checkInTime ? formatTime(visit.checkInTime) : null,
      checkOutTime: visit.checkOutTime ? formatTime(visit.checkOutTime) : null,
      meetingDurationMin: visit.meetingDurationMin ?? null,
      discussionNotes: visit.discussionNotes ?? null,
      doctorFeedback: visit.doctorFeedback ?? null,
      visitOutcome: visit.visitOutcome ?? null,
      nextFollowUp: visit.nextFollowUp ? visit.nextFollowUp.toISOString().slice(0, 10) : null,
      remarks: visit.remarks,
      doctor: visit.doctor ?? null,
      mr: visit.mr ?? null,
      products:
        visit.products?.map((product) => ({
          id: product.medicine.id,
          name: product.medicine.name,
          notes: product.notes ?? null,
        })) ?? [],
      distributions:
        visit.distributions?.map((row) => ({
          id: row.id,
          medicineId: row.medicine.id,
          medicineName: row.medicine.name,
          quantity: row.qty,
          batchNumber: row.batch.batchNo,
          remarks: row.note,
        })) ?? [],
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    };
  }
}
