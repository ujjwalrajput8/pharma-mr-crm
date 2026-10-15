import { PrismaService } from '../prisma/PrismaService';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { UserRepository } from '../repositories/UserRepository';
import { HolidayService } from './HolidayService';
import { TourPlanService, type PublicTourPlanDay } from './TourPlanService';
import { formatDateOnly, monthRange, todayDateOnly } from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

function formatClock(value: Date): string {
  return `${String(value.getUTCHours()).padStart(2, '0')}:${String(value.getUTCMinutes()).padStart(2, '0')}`;
}

export interface MyDaySnapshot {
  date: string;
  attendance: {
    id: number;
    checkInAt: string | null;
    checkOutAt: string | null;
    status: string;
    workType: string | null;
    workingMins: number | null;
  } | null;
  /** Today's day from the approved tour plan; calls carry a `done` flag. */
  tourPlanDay: (PublicTourPlanDay & { calls: Array<PublicTourPlanDay['calls'][number] & { done: boolean }> }) | null;
  appointments: Array<{
    id: number;
    time: string;
    status: string;
    purpose: string | null;
    doctor: { id: number; fullName: string; phone: string | null } | null;
  }>;
  pendingFollowUps: Array<{
    id: number;
    visitDate: string;
    nextFollowUp: string;
    doctor: { id: number; fullName: string } | null;
  }>;
  leaveToday: {
    id: number;
    leaveType: { code: string; name: string; colorHex: string } | null;
    fromDate: string;
    toDate: string;
    dayPart: string;
  } | null;
  holidayToday: string | null;
  counts: { visitsThisMonth: number; appointmentsToday: number };
}

/**
 * MyDayService — one read model for the MR's home screen: today's check-in,
 * the approved plan's call list, appointments, due follow-ups and context
 * (leave / holiday) — composed from the existing domain services.
 */
export class MyDayService {
  private static instance: MyDayService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly attendance = AttendanceRepository.getInstance(),
    private readonly users = UserRepository.getInstance(),
    private readonly holidays = HolidayService.getInstance(),
    private readonly tourPlans = TourPlanService.getInstance(),
  ) {}

  public static getInstance(): MyDayService {
    if (!MyDayService.instance) MyDayService.instance = new MyDayService();
    return MyDayService.instance;
  }

  public async snapshot(actor: AuthUser): Promise<MyDaySnapshot> {
    const today = todayDateOnly();
    const todayKey = formatDateOnly(today);
    const { start, end } = monthRange(today);

    const [user, attendanceRow, tourPlanDay, appointments, visitsToday, followUps, leaveToday, visitsThisMonth] =
      await Promise.all([
        this.users.findById(actor.id),
        this.attendance.findToday(actor.id, today),
        this.tourPlans.todayForActor(actor),
        this.prisma.appointment.findMany({
          where: { mrId: actor.id, date: today, deletedAt: null },
          orderBy: { time: 'asc' },
          include: { doctor: { select: { id: true, fullName: true, phone: true } } },
        }),
        this.prisma.visit.findMany({
          where: { mrId: actor.id, visitDate: today, deletedAt: null },
          select: { doctorId: true, chemistId: true },
        }),
        this.prisma.visit.findMany({
          where: {
            mrId: actor.id,
            deletedAt: null,
            nextFollowUp: { not: null, lte: today },
          },
          orderBy: { nextFollowUp: 'asc' },
          take: 20,
          include: { doctor: { select: { id: true, fullName: true } } },
        }),
        this.prisma.leaveRequest.findFirst({
          where: {
            userId: actor.id,
            deletedAt: null,
            status: 'APPROVED',
            fromDate: { lte: today },
            toDate: { gte: today },
          },
          include: { leaveType: { select: { code: true, name: true, colorHex: true } } },
        }),
        this.prisma.visit.count({
          where: { mrId: actor.id, deletedAt: null, visitDate: { gte: start, lte: end } },
        }),
      ]);

    const holidayMap = await this.holidays.mapInRange(today, today, user?.territoryId ?? null);
    const holidayToday = holidayMap.get(todayKey)?.name ?? null;

    // A planned call counts as done when any visit or live appointment exists
    // for that doctor / chemist today.
    const doneDoctorIds = new Set<number>();
    const doneChemistIds = new Set<number>();
    for (const visit of visitsToday) {
      if (visit.doctorId) doneDoctorIds.add(visit.doctorId);
      if (visit.chemistId) doneChemistIds.add(visit.chemistId);
    }
    for (const appointment of appointments) {
      if (appointment.status === 'COMPLETED' || appointment.status === 'VISITED') {
        doneDoctorIds.add(appointment.doctorId);
      }
    }

    return {
      date: todayKey,
      attendance: attendanceRow
        ? {
            id: attendanceRow.id,
            checkInAt: attendanceRow.checkInAt?.toISOString() ?? null,
            checkOutAt: attendanceRow.checkOutAt?.toISOString() ?? null,
            status: attendanceRow.status,
            workType: attendanceRow.workType,
            workingMins: attendanceRow.workingMins,
          }
        : null,
      tourPlanDay: tourPlanDay
        ? {
            ...tourPlanDay,
            calls: tourPlanDay.calls.map((call) => ({
              ...call,
              done: Boolean(
                (call.doctor && doneDoctorIds.has(call.doctor.id)) ||
                  (call.chemist && doneChemistIds.has(call.chemist.id)),
              ),
            })),
          }
        : null,
      appointments: appointments.map((row) => ({
        id: row.id,
        time: formatClock(row.time),
        status: row.status,
        purpose: row.purpose,
        doctor: row.doctor,
      })),
      pendingFollowUps: followUps
        .filter((row) => row.nextFollowUp)
        .map((row) => ({
          id: row.id,
          visitDate: formatDateOnly(row.visitDate),
          nextFollowUp: formatDateOnly(row.nextFollowUp as Date),
          doctor: row.doctor,
        })),
      leaveToday: leaveToday
        ? {
            id: leaveToday.id,
            leaveType: leaveToday.leaveType,
            fromDate: formatDateOnly(leaveToday.fromDate),
            toDate: formatDateOnly(leaveToday.toDate),
            dayPart: leaveToday.dayPart,
          }
        : null,
      holidayToday,
      counts: {
        visitsThisMonth,
        appointmentsToday: appointments.filter((row) => row.status !== 'CANCELLED').length,
      },
    };
  }
}
