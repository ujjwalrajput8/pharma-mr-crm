import { RecordStatuses, UserStatuses } from '../constants';
import { PrismaService } from '../prisma/PrismaService';
import { TeamScopeService } from './TeamScopeService';
import { addDays, formatDateOnly, todayDateOnly } from '../utils/datetime';
import type { AuthUser } from '../types/auth.types';

export type OccasionKind = 'BIRTHDAY' | 'ANNIVERSARY' | 'WORK_ANNIVERSARY';
export type OccasionPersonType = 'DOCTOR' | 'EMPLOYEE';

export interface Occasion {
  /** Stable per person + kind, e.g. `DOCTOR-12-BIRTHDAY`. */
  id: string;
  personType: OccasionPersonType;
  personId: number;
  name: string;
  /** Specialization · city for doctors, designation for employees. */
  subtitle: string | null;
  phone: string | null;
  kind: OccasionKind;
  /** The stored date, `YYYY-MM-DD`. */
  date: string;
  /** Next occurrence on or after today, `YYYY-MM-DD`. */
  nextDate: string;
  daysAway: number;
  /** Years completed on `nextDate`; null when the stored year is not in the past. */
  years: number | null;
  /** Client route to the person's profile. */
  href: string;
}

const MS_PER_DAY = 86_400_000;

/** Next date on or after `today` with `date`'s month and day. 29 Feb falls on 28 Feb in common years. */
export function nextOccurrence(date: Date, today: Date): Date {
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const inYear = (year: number): Date => {
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
  };
  const thisYear = inYear(today.getUTCFullYear());
  return thisYear.getTime() >= today.getTime() ? thisYear : inYear(today.getUTCFullYear() + 1);
}

type PersonBase = Pick<
  Occasion,
  'personType' | 'personId' | 'name' | 'subtitle' | 'phone' | 'href'
>;

/**
 * OccasionService — doctor and employee birthdays and anniversaries.
 *
 * Only month and day decide when an occasion falls; the stored year just feeds
 * the "5th anniversary" count. Scope follows the dashboard:
 *   Doctors   → Admin: all; Manager: assigned to their team; MR: assigned to them
 *   Employees → Admin: everyone; Manager: their reporting sub-tree; never yourself
 */
export class OccasionService {
  private static instance: OccasionService | null = null;

  private constructor(
    private readonly prisma = PrismaService.getClient(),
    private readonly scope = TeamScopeService.getInstance(),
  ) {}

  public static getInstance(): OccasionService {
    if (!OccasionService.instance) {
      OccasionService.instance = new OccasionService();
    }
    return OccasionService.instance;
  }

  /** Occasions falling within the next `days` days (today counts as day 0), soonest first. */
  public async upcoming(
    actor: AuthUser,
    params: { days: number; type?: OccasionPersonType },
  ): Promise<{ from: string; to: string; items: Occasion[] }> {
    const can = (key: string): boolean => (actor.permissions ?? []).includes(key);
    const today = todayDateOnly();
    const userIds = await this.scope.visibleUserIds(actor);

    const [doctors, employees] = await Promise.all([
      params.type !== 'EMPLOYEE' && (can('doctors:own') || can('doctors:manage'))
        ? this.doctorOccasions(userIds, today)
        : Promise.resolve([]),
      params.type !== 'DOCTOR' ? this.employeeOccasions(actor, userIds, today) : Promise.resolve([]),
    ]);

    const items = [...doctors, ...employees]
      .filter((item) => item.daysAway <= params.days)
      .sort((a, b) => a.daysAway - b.daysAway || a.name.localeCompare(b.name));

    return {
      from: formatDateOnly(today),
      to: formatDateOnly(addDays(today, params.days)),
      items,
    };
  }

  private async doctorOccasions(
    userIds: number[] | undefined,
    today: Date,
  ): Promise<Occasion[]> {
    const doctors = await this.prisma.doctor.findMany({
      where: {
        deletedAt: null,
        status: RecordStatuses.ACTIVE,
        OR: [{ birthday: { not: null } }, { anniversary: { not: null } }],
        ...(userIds
          ? {
              assignments: {
                some: { mrId: { in: userIds }, isActive: true, deletedAt: null },
              },
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        specialization: true,
        city: true,
        phone: true,
        birthday: true,
        anniversary: true,
      },
    });

    return doctors.flatMap((doctor) => {
      const base: PersonBase = {
        personType: 'DOCTOR',
        personId: doctor.id,
        name: doctor.fullName,
        subtitle: [doctor.specialization, doctor.city].filter(Boolean).join(' · ') || null,
        phone: doctor.phone,
        href: `/doctors/${doctor.id}`,
      };
      return [
        this.build(base, 'BIRTHDAY', doctor.birthday, today),
        this.build(base, 'ANNIVERSARY', doctor.anniversary, today),
      ].filter((item): item is Occasion => item !== null);
    });
  }

  private async employeeOccasions(
    actor: AuthUser,
    userIds: number[] | undefined,
    today: Date,
  ): Promise<Occasion[]> {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        status: UserStatuses.ACTIVE,
        id: { not: actor.id, ...(userIds ? { in: userIds } : {}) },
        mrProfile: {
          is: {
            deletedAt: null,
            OR: [
              { dob: { not: null } },
              { anniversary: { not: null } },
              { joiningDate: { not: null } },
            ],
          },
        },
      },
      select: {
        id: true,
        fullName: true,
        phone: true,
        role: true,
        mrProfile: {
          select: { designation: true, dob: true, anniversary: true, joiningDate: true },
        },
      },
    });

    return users.flatMap((user) => {
      const profile = user.mrProfile;
      if (!profile) return [];
      const base: PersonBase = {
        personType: 'EMPLOYEE',
        personId: user.id,
        name: user.fullName,
        subtitle: profile.designation ?? user.role,
        phone: user.phone,
        href: `/employees/${user.id}`,
      };
      return [
        this.build(base, 'BIRTHDAY', profile.dob, today),
        this.build(base, 'ANNIVERSARY', profile.anniversary, today),
        this.build(base, 'WORK_ANNIVERSARY', profile.joiningDate, today),
      ].filter((item): item is Occasion => item !== null);
    });
  }

  private build(
    base: PersonBase,
    kind: OccasionKind,
    date: Date | null,
    today: Date,
  ): Occasion | null {
    if (!date) return null;
    const next = nextOccurrence(date, today);
    const years = next.getUTCFullYear() - date.getUTCFullYear();
    // A joining date only becomes an anniversary once a full year has passed.
    if (kind === 'WORK_ANNIVERSARY' && years < 1) return null;

    return {
      ...base,
      id: `${base.personType}-${base.personId}-${kind}`,
      kind,
      date: formatDateOnly(date),
      nextDate: formatDateOnly(next),
      daysAway: Math.round((next.getTime() - today.getTime()) / MS_PER_DAY),
      years: years > 0 ? years : null,
    };
  }
}
