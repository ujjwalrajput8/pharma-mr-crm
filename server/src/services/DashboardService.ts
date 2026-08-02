import { AppRoles, AppointmentStatuses } from '../constants';
import { PrismaService } from '../prisma/PrismaService';
import type { AuthUser } from '../types/auth.types';

export class DashboardService {
  private static instance: DashboardService | null = null;

  private constructor(private readonly prisma = PrismaService.getClient()) {}

  public static getInstance(): DashboardService {
    if (!DashboardService.instance) {
      DashboardService.instance = new DashboardService();
    }
    return DashboardService.instance;
  }

  public async getSummary(actor: AuthUser) {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setUTCHours(23, 59, 59, 999);
    const todayDate = new Date(todayStart.toISOString().slice(0, 10) + 'T00:00:00.000Z');

    if (actor.role === AppRoles.ADMIN) {
      const [
        totalMrs,
        totalDoctors,
        totalStores,
        totalMedicines,
        todaysAppointments,
        todaysVisits,
        pendingAppointments,
        stocks,
      ] = await Promise.all([
        this.prisma.user.count({ where: { role: AppRoles.MR, deletedAt: null } }),
        this.prisma.doctor.count({ where: { deletedAt: null } }),
        this.prisma.medicalStore.count({ where: { deletedAt: null } }),
        this.prisma.medicine.count({ where: { deletedAt: null } }),
        this.prisma.appointment.count({
          where: { deletedAt: null, date: todayDate },
        }),
        this.prisma.visit.count({
          where: { deletedAt: null, visitDate: todayDate },
        }),
        this.prisma.appointment.count({
          where: { deletedAt: null, status: AppointmentStatuses.PENDING },
        }),
        this.prisma.stock.findMany({ where: { deletedAt: null } }),
      ]);

      const lowStockCount = stocks.filter((s) => s.available <= s.minimumStockAlert).length;

      return {
        role: actor.role,
        cards: {
          totalMrs,
          totalDoctors,
          totalStores,
          totalMedicines,
          todaysAppointments,
          todaysVisits,
          pendingAppointments,
          lowStockCount,
        },
      };
    }

    const [todaysAppointments, todaysVisits, pendingFollowUps, assignedDoctors, pendingAppointments] =
      await Promise.all([
        this.prisma.appointment.count({
          where: { deletedAt: null, mrId: actor.id, date: todayDate },
        }),
        this.prisma.visit.count({
          where: { deletedAt: null, mrId: actor.id, visitDate: todayDate },
        }),
        this.prisma.visit.count({
          where: {
            deletedAt: null,
            mrId: actor.id,
            nextFollowUp: { lte: todayEnd, gte: todayStart },
          },
        }),
        this.prisma.doctorAssignment.count({
          where: { deletedAt: null, mrId: actor.id, isActive: true },
        }),
        this.prisma.appointment.count({
          where: {
            deletedAt: null,
            mrId: actor.id,
            status: AppointmentStatuses.PENDING,
          },
        }),
      ]);

    return {
      role: actor.role,
      cards: {
        todaysAppointments,
        todaysVisits,
        pendingFollowUps,
        assignedDoctors,
        pendingAppointments,
      },
    };
  }
}
