import { AppRoles } from '../constants';
import type { ListDistributionsQueryDto } from '../dto/distribution.dto';
import { DistributionRepository } from '../repositories/DistributionRepository';
import type { AuthUser } from '../types/auth.types';

function parseDateStart(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function parseDateEnd(value: string): Date {
  return new Date(`${value}T23:59:59.999Z`);
}

/**
 * DistributionService — read-only ledger of sample distributions.
 * Creates happen only via AppointmentService.completeWithVisit.
 */
export class DistributionService {
  private static instance: DistributionService | null = null;

  private constructor(private readonly distributions = DistributionRepository.getInstance()) {}

  public static getInstance(): DistributionService {
    if (!DistributionService.instance) {
      DistributionService.instance = new DistributionService();
    }
    return DistributionService.instance;
  }

  public async list(query: ListDistributionsQueryDto, actor: AuthUser) {
    const { items, total } = await this.distributions.list({
      page: query.page,
      limit: query.limit,
      medicineId: query.medicineId,
      visitId: query.visitId,
      mrId: actor.role === AppRoles.MR ? actor.id : undefined,
      from: query.from ? parseDateStart(query.from) : undefined,
      to: query.to ? parseDateEnd(query.to) : undefined,
    });

    return {
      items: items.map((item) => ({
        id: item.id,
        visitId: item.visitId,
        medicineId: item.medicineId,
        medicineName: item.medicine.name,
        doctorId: item.doctorId,
        doctorName: item.doctor?.fullName ?? 'Unknown',
        mrId: item.mrId,
        mrName: item.mr?.fullName ?? 'Unknown',
        quantity: item.quantity,
        batchNumber: item.batchNumber,
        remarks: item.remarks,
        distributedAt: item.distributedAt.toISOString(),
        visitDate: item.visit?.visitDate.toISOString().slice(0, 10) ?? null,
      })),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / query.limit)),
      },
    };
  }
}
