export type AppointmentMeta = {
  location?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
};

export type VisitMeta = {
  checkIn?: string;
  checkOut?: string;
  outcome?: string;
};

type Packed<T> = { meta: T; text: string };

function pack<T extends object>(text: string, meta: T): string {
  const hasMeta = Object.values(meta).some((v) => v !== undefined && v !== '');
  if (!hasMeta) return text;
  return JSON.stringify({ meta, text } satisfies Packed<T>);
}

function unpack<T extends object>(raw: string | null | undefined, fallback: T): { text: string; meta: T } {
  if (!raw) return { text: '', meta: fallback };
  try {
    const parsed = JSON.parse(raw) as Packed<T>;
    if (parsed && typeof parsed === 'object' && 'meta' in parsed) {
      return { text: parsed.text ?? '', meta: { ...fallback, ...parsed.meta } };
    }
  } catch {
    /* plain remarks */
  }
  return { text: raw, meta: fallback };
}

export function packAppointmentRemarks(text: string, meta: AppointmentMeta): string | undefined {
  const packed = pack(text, meta);
  return packed || undefined;
}

export function unpackAppointmentRemarks(raw: string | null | undefined) {
  return unpack<AppointmentMeta>(raw, {});
}

export function packVisitRemarks(text: string, meta: VisitMeta): string | undefined {
  const packed = pack(text, meta);
  return packed || undefined;
}

export function unpackVisitRemarks(raw: string | null | undefined) {
  return unpack<VisitMeta>(raw, {});
}

export function packProductNotes(input: {
  remarks?: string;
  interestLevel?: string;
  prescriptionExpected?: boolean;
}): string | undefined {
  const parts: string[] = [];
  if (input.interestLevel) parts.push(`Interest: ${input.interestLevel}`);
  if (input.prescriptionExpected) parts.push('Prescription expected: Yes');
  if (input.remarks?.trim()) parts.push(input.remarks.trim());
  return parts.length ? parts.join(' · ') : undefined;
}
