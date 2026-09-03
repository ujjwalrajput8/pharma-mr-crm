/**
 * Business-timezone date helpers.
 *
 * The whole app stores day-granular values (`@db.Date`) as UTC-midnight timestamps.
 * Deriving "today" with `new Date().toISOString()` on a UTC server puts every
 * check-in before 05:30 IST on the *previous* calendar day — and the
 * `@@unique([userId, attDate])` constraint then blocks the real check-in.
 * Everything day-related must go through these helpers.
 */

/** Minutes east of UTC for the business timezone. IST (+05:30) by default. */
export const TIMEZONE_OFFSET_MINUTES = Number(
  process.env.APP_TIMEZONE_OFFSET_MINUTES ?? 330,
);

const MS_PER_MINUTE = 60_000;
const MS_PER_DAY = 86_400_000;

/** `YYYY-MM-DD` for the given instant in business-local time. */
export function toLocalDateString(instant: Date = new Date()): string {
  return new Date(instant.getTime() + TIMEZONE_OFFSET_MINUTES * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
}

/** UTC-midnight `Date` for a `YYYY-MM-DD` string — the storage form of a date-only column. */
export function parseDateOnly(value: string): Date {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return parsed;
}

/** Business-local "today" as a UTC-midnight `Date`. */
export function todayDateOnly(): Date {
  return parseDateOnly(toLocalDateString());
}

/** Storage form of a date-only column back to `YYYY-MM-DD`. */
export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Current wall-clock minutes since local midnight — used for late-arrival checks. */
export function localMinutesOfDay(instant: Date = new Date()): number {
  const shifted = new Date(instant.getTime() + TIMEZONE_OFFSET_MINUTES * MS_PER_MINUTE);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

/** Parses `HH:mm` into minutes since midnight; `null` when malformed. */
export function parseClockToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Inclusive list of UTC-midnight dates from `from` to `to`. */
export function eachDayInclusive(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let cursor = from; cursor.getTime() <= to.getTime(); cursor = addDays(cursor, 1)) {
    days.push(cursor);
  }
  return days;
}

/** Day index of a date-only value (0 = Sunday). Safe because storage is UTC-midnight. */
export function dayOfWeek(date: Date): number {
  return date.getUTCDay();
}

export function isSunday(date: Date): boolean {
  return dayOfWeek(date) === 0;
}

/** First and last UTC-midnight date of the month containing `date`. */
export function monthRange(date: Date): { start: Date; end: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1)),
    end: new Date(Date.UTC(year, month + 1, 0)),
  };
}

/** Calendar year of a date-only value. */
export function yearOf(date: Date): number {
  return date.getUTCFullYear();
}

/** Business-local current year. */
export function currentYear(): number {
  return Number(toLocalDateString().slice(0, 4));
}
