import { PrismaService } from '../prisma/PrismaService';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { SettingRepository } from '../repositories/SettingRepository';
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
  /** Today's day from the approved tour plan; calls carry `done` and the visit that did it. */
  tourPlanDay: (PublicTourPlanDay & {
    calls: Array<PublicTourPlanDay['calls'][number] & { done: boolean; visit: { id: number; time: string } | null }>;
  }) | null;
  appointments: Array<{
    id: number;
    time: string;
    status: string;
    purpose: string | null;
    visitId: number | null;
    /** Still open (pending / rescheduled) — Complete, Reschedule and No-show apply. */
    open: boolean;
    doctor: { id: number; fullName: string; phone: string | null; mslNo: string; area: string | null; address: string | null } | null;
  }>;
  pendingFollowUps: Array<{
    id: number;
    visitDate: string;
    nextFollowUp: string;
    doctor: { id: number; fullName: string; mslNo: string; area: string | null } | null;
  }>;
  /** Assigned doctors still short of their class target this month (A 3 · B 2 · C 1 by default). */
  visitDue: Array<{
    doctor: { id: number; fullName: string; mslNo: string; mslClass: string | null; area: string | null };
    target: number;
    done: number;
  }>;
  leaveToday: {
    id: number;
    leaveType: { code: string; name: string; colorHex: string } | null;
    fromDate: string;
    toDate: string;
    dayPart: string;
  } | null;
  holidayToday: string | null;
  counts: {
    visitsThisMonth: number;
    appointmentsToday: number;
    visitsToday: number;
    callsPlanned: number;
    callsDone: number;
    samplesToday: number;
    bagUnits: number;
    /** Medicines in the bag with 5 or fewer units left. */
    lowStock: number;
  };
}

const DEFAULT_FREQUENCY: Record<string, number> = { A: 3, B: 2, C: 1 };
const OPEN = ['PENDING', 'RESCHEDULED', 'REQUESTED', 'CONFIRMED'];

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
    private readonly settings = SettingRepository.getInstance(),
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
          include: {
            doctor: { select: { id: true, fullName: true, phone: true, mslNo: true, area: true, address: true } },
            visit: { select: { id: true, deletedAt: true } },
          },
        }),
        this.prisma.visit.findMany({
          where: { mrId: actor.id, visitDate: today, deletedAt: null },
          select: { id: true, doctorId: true, chemistId: true, visitTime: true },
          orderBy: { visitTime: 'asc' },
        }),
        this.prisma.visit.findMany({
          where: {
            mrId: actor.id,
            deletedAt: null,
            nextFollowUp: { not: null, lte: today },
          },
          orderBy: { nextFollowUp: 'asc' },
          take: 40,
          include: { doctor: { select: { id: true, fullName: true, mslNo: true, area: true } } },
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

    const [holidayMap, extra] = await Promise.all([
      this.holidays.mapInRange(today, today, user?.territoryId ?? null),
      this.extras(actor.id, today, start, end, followUps),
    ]);
    const holidayToday = holidayMap.get(todayKey)?.name ?? null;

    // A planned call counts as done when any visit or live appointment exists
    // for that doctor / chemist today.
    const doneDoctorIds = new Set<number>();
    const doneChemistIds = new Set<number>();
    const visitByDoctor = new Map<number, { id: number; time: string }>();
    for (const visit of visitsToday) {
      if (visit.doctorId) {
        doneDoctorIds.add(visit.doctorId);
        if (!visitByDoctor.has(visit.doctorId)) {
          visitByDoctor.set(visit.doctorId, { id: visit.id, time: formatClock(visit.visitTime) });
        }
      }
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
              visit: call.doctor ? (visitByDoctor.get(call.doctor.id) ?? null) : null,
            })),
          }
        : null,
      appointments: appointments.map((row) => ({
        id: row.id,
        time: formatClock(row.time),
        status: row.status,
        purpose: row.purpose,
        visitId: row.visit && !row.visit.deletedAt ? row.visit.id : null,
        open: OPEN.includes(row.status),
        doctor: row.doctor,
      })),
      // A follow-up is settled by any later visit to that doctor (B-V9).
      pendingFollowUps: followUps
        .filter((row) => row.nextFollowUp && !extra.followedUp.has(row.id))
        .slice(0, 20)
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
      visitDue: extra.visitDue,
      counts: {
        visitsThisMonth,
        appointmentsToday: appointments.filter((row) => row.status !== 'CANCELLED').length,
        visitsToday: visitsToday.length,
        callsPlanned: tourPlanDay?.calls.length ?? 0,
        callsDone:
          tourPlanDay?.calls.filter(
            (call) =>
              (call.doctor && doneDoctorIds.has(call.doctor.id)) ||
              (call.chemist && doneChemistIds.has(call.chemist.id)),
          ).length ?? 0,
        samplesToday: extra.samplesToday,
        bagUnits: extra.bagUnits,
        lowStock: extra.lowStock,
      },
    };
  }

  /** Follow-ups already met, the class-target "visit due" list, today's samples and the bag. */
  private async extras(
    mrId: number,
    today: Date,
    monthStart: Date,
    monthEnd: Date,
    followUps: Array<{ id: number; doctorId: number | null; visitDate: Date }>,
  ) {
    const followDoctorIds = [...new Set(followUps.map((f) => f.doctorId).filter((id): id is number => id != null))];
    const [laterVisits, assigned, monthVisits, samples, bag, frequency] = await Promise.all([
      followDoctorIds.length === 0
        ? Promise.resolve([] as Array<{ doctorId: number | null; _max: { visitDate: Date | null } }>)
        : this.prisma.visit.groupBy({
            by: ['doctorId'],
            where: { mrId, deletedAt: null, doctorId: { in: followDoctorIds } },
            _max: { visitDate: true },
          }),
      this.prisma.doctorAssignment.findMany({
        where: { mrId, isActive: true, deletedAt: null, doctor: { deletedAt: null, status: 'ACTIVE' } },
        select: { doctor: { select: { id: true, fullName: true, mslNo: true, mslClass: true, area: true } } },
      }),
      this.prisma.visit.groupBy({
        by: ['doctorId'],
        where: { mrId, deletedAt: null, visitDate: { gte: monthStart, lte: monthEnd } },
        _count: { _all: true },
      }),
      this.prisma.stockTxn.aggregate({
        where: { txnType: 'SAMPLE_GIVEN', fromHolderType: 'USER', fromHolderId: mrId, txnDate: today },
        _sum: { qty: true },
      }),
      this.prisma.stockBalance.groupBy({
        by: ['medicineId'],
        where: { holderType: 'USER', holderId: mrId, qty: { gt: 0 } },
        _sum: { qty: true },
      }),
      this.frequencyTargets(),
    ]);
    const lastVisit = new Map(laterVisits.map((row) => [row.doctorId, row._max.visitDate?.getTime() ?? 0]));
    const followedUp = new Set(
      followUps
        .filter((f) => f.doctorId != null && (lastVisit.get(f.doctorId) ?? 0) > f.visitDate.getTime())
        .map((f) => f.id),
    );
    const doneThisMonth = new Map(monthVisits.map((row) => [row.doctorId, row._count._all]));
    const visitDue = assigned
      .map(({ doctor }) => ({
        doctor,
        target: frequency[doctor.mslClass ?? ''] ?? 0,
        done: doneThisMonth.get(doctor.id) ?? 0,
      }))
      .filter((row) => row.target > row.done)
      .sort((a, b) => b.target - b.done - (a.target - a.done) || a.doctor.fullName.localeCompare(b.doctor.fullName))
      .slice(0, 20);
    return {
      followedUp,
      visitDue,
      samplesToday: samples._sum.qty ?? 0,
      bagUnits: bag.reduce((sum, row) => sum + (row._sum.qty ?? 0), 0),
      lowStock: bag.filter((row) => (row._sum.qty ?? 0) <= 5).length,
    };
  }

  /** Visits per month by MSL class — Settings "visit.frequency.<class>", else A 3 · B 2 · C 1. */
  private async frequencyTargets(): Promise<Record<string, number>> {
    const out: Record<string, number> = { ...DEFAULT_FREQUENCY };
    const rows = await this.settings.list('visit');
    for (const row of rows) {
      const match = /^visit.frequency.([A-Z])$/.exec(row.key);
      const value = Number(row.value);
      if (match && Number.isInteger(value) && value >= 0 && value <= 31) out[match[1]!] = value;
    }
    return out;
  }
}
