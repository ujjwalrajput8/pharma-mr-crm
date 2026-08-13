import type { Appointment, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

const appointmentInclude = {
  doctor: { select: { id: true, fullName: true } },
  mr: { select: { id: true, fullName: true, email: true } },
  assignedBy: { select: { id: true, fullName: true, email: true, role: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: typeof appointmentInclude;
}>;

export class AppointmentRepository {
  private static instance: AppointmentRepository | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): AppointmentRepository {
    if (!AppointmentRepository.instance) {
      AppointmentRepository.instance = new AppointmentRepository();
    }
    return AppointmentRepository.instance;
  }

  public create(data: Prisma.AppointmentCreateInput) {
    return this.prisma.appointment.create({
      data,
      include: appointmentInclude,
    });
  }

  public update(id: number, data: Prisma.AppointmentUpdateInput) {
    return this.prisma.appointment.update({
      where: { id },
      data,
      include: appointmentInclude,
    });
  }

  public findById(id: number) {
    return this.prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: appointmentInclude,
    });
  }

  public softDelete(id: number, updatedBy?: number): Promise<Appointment> {
    return this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    mrId?: number;
    mrIds?: number[];
    doctorId?: number;
    status?: string;
  }) {
    const where: Prisma.AppointmentWhereInput = {
      deletedAt: null,
      ...(params.mrId ? { mrId: params.mrId } : {}),
      ...(params.mrIds && params.mrIds.length > 0 ? { mrId: { in: params.mrIds } } : {}),
      ...(params.doctorId ? { doctorId: params.doctorId } : {}),
      ...(params.status
        ? { status: params.status as Prisma.EnumAppointmentStatusFilter['equals'] }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        orderBy: [{ date: 'desc' }, { time: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: appointmentInclude,
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total };
  }
}
