/** Date helpers — ISO date (yyyy-MM-dd) and 24h time (HH:mm) for API payloads. */

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y!, m! - 1, d);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function formatDisplayDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Convert "HH:mm" (24h) → "hh:mm AM/PM" */
export function formatTime12(hhmm: string): string {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return hhmm;
  let hours = Number(match[1]);
  const minutes = match[2]!;
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, '0')}:${minutes} ${period}`;
}

/** Convert "hh:mm AM/PM" or loose input → "HH:mm" */
export function parseTime12To24(input: string): string | null {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, ' ');
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/.exec(cleaned);
  if (!match) {
    const h24 = /^(\d{1,2}):(\d{2})$/.exec(cleaned);
    if (!h24) return null;
    const h = Number(h24[1]);
    const m = Number(h24[2]);
    if (h > 23 || m > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3];
  if (hours < 1 || hours > 12 || minutes > 59) return null;
  if (period === 'AM') {
    if (hours === 12) hours = 0;
  } else if (hours !== 12) {
    hours += 12;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function minutesBetween(startHHmm: string, endHHmm: string): number | null {
  const [sh, sm] = startHHmm.split(':').map(Number);
  const [eh, em] = endHHmm.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const start = sh! * 60 + sm!;
  const end = eh! * 60 + em!;
  const diff = end - start;
  return diff > 0 ? diff : null;
}

export function addMinutesToHHmm(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h! * 60 + m! + minutes;
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const nh = Math.floor(normalized / 60);
  const nm = normalized % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

export function shortId(id: string | number): string {
  return String(id).slice(0, 8).toUpperCase();
}
