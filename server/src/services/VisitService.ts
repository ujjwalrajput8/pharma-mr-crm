import { AppRoles } from '../constants';
import type { ListVisitsQueryDto } from '../dto/visit.dto';
import { ForbiddenError, NotFoundError } from '../errors/AppError';
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

  private constructor(private readonly visits = VisitRepository.getInstance()) {}

  public static getInstance(): VisitService {
    if (!VisitService.instance) {
      VisitService.instance = new VisitService();
    }
    return VisitService.instance;
  }

  public async list(query: ListVisitsQueryDto, actor: AuthUser) {
    const { items, total } = await this.visits.list({
      page: query.page,
      limit: query.limit,
      doctorId: query.doctorId,
      mrId: actor.role === AppRoles.MR ? actor.id : undefined,
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

  public async remove(id: string, actor: AuthUser) {
    const visit = await this.visits.findById(id);
    if (!visit) throw new NotFoundError('Visit not found');
    if (actor.role === AppRoles.MR && visit.mrId !== actor.id) {
      throw new ForbiddenError('You can only delete your own visits');
    }
    await this.visits.softDelete(id, actor.id);
  }

  private toPublic(visit: {
    id: string;
    appointmentId?: string | null;
    doctorId: string;
    mrId: string;
    visitDate: Date;
    visitTime?: Date | null;
    meetingDurationMin?: number | null;
    discussionNotes?: string | null;
    doctorFeedback?: string | null;
    remarks: string | null;
    nextFollowUp: Date | null;
    createdAt: Date;
    updatedAt: Date;
    doctor?: { id: string; fullName: string };
    mr?: { id: string; fullName: string; email: string };
    products?: Array<{ medicine: { id: string; name: string } }>;
  }) {
    return {
      id: visit.id,
      appointmentId: visit.appointmentId ?? null,
      doctorId: visit.doctorId,
      mrId: visit.mrId,
      visitDate: visit.visitDate.toISOString().slice(0, 10),
      visitTime: visit.visitTime ? formatTime(visit.visitTime) : null,
      meetingDurationMin: visit.meetingDurationMin ?? null,
      discussionNotes: visit.discussionNotes ?? null,
      doctorFeedback: visit.doctorFeedback ?? null,
      nextFollowUp: visit.nextFollowUp ? visit.nextFollowUp.toISOString().slice(0, 10) : null,
      remarks: visit.remarks,
      doctor: visit.doctor ?? null,
      mr: visit.mr ?? null,
      products: visit.products?.map((product) => product.medicine) ?? [],
      createdAt: visit.createdAt,
      updatedAt: visit.updatedAt,
    };
  }
}
