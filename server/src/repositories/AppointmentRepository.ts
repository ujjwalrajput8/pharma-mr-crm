import type { Appointment, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/PrismaService';

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
      include: {
        doctor: { select: { id: true, fullName: true } },
        mr: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public update(id: string, data: Prisma.AppointmentUpdateInput) {
    return this.prisma.appointment.update({
      where: { id },
      data,
      include: {
        doctor: { select: { id: true, fullName: true } },
        mr: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public findById(id: string) {
    return this.prisma.appointment.findFirst({
      where: { id, deletedAt: null },
      include: {
        doctor: { select: { id: true, fullName: true } },
        mr: { select: { id: true, fullName: true, email: true } },
      },
    });
  }

  public softDelete(id: string, updatedBy?: string): Promise<Appointment> {
    return this.prisma.appointment.update({
      where: { id },
      data: { deletedAt: new Date(), ...(updatedBy ? { updatedBy } : {}) },
    });
  }

  public async list(params: {
    page: number;
    limit: number;
    mrId?: string;
    doctorId?: string;
    status?: string;
  }) {
    const where: Prisma.AppointmentWhereInput = {
      deletedAt: null,
      ...(params.mrId ? { mrId: params.mrId } : {}),
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
        include: {
          doctor: { select: { id: true, fullName: true } },
          mr: { select: { id: true, fullName: true, email: true } },
        },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return { items, total };
  }
}
