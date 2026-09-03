import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type NotificationKind =
  | 'LEAVE_PENDING'
  | 'LEAVE_DECIDED'
  | 'ATTENDANCE_FLAGGED'
  | 'ATTENDANCE_MISSING'
  | 'APPOINTMENT_TODAY'
  | 'DOCTOR_OCCASION';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  at: string | null;
  count?: number;
}

export interface NotificationFeed {
  items: AppNotification[];
  total: number;
  counts: Partial<Record<NotificationKind, number>>;
}

export const notificationsApi = {
  async list(): Promise<NotificationFeed> {
    const { data } = await api.get<ApiSuccess<NotificationFeed>>('/notifications');
    return data.data;
  },
};

/** Kinds that represent work waiting on the signed-in user. */
export const ACTIONABLE_KINDS: NotificationKind[] = [
  'LEAVE_PENDING',
  'ATTENDANCE_FLAGGED',
  'ATTENDANCE_MISSING',
];

export function countActionable(feed: NotificationFeed | undefined): number {
  if (!feed) return 0;
  return feed.items.filter((item) => ACTIONABLE_KINDS.includes(item.kind)).length;
}

export const NOTIFICATION_LABEL: Record<NotificationKind, string> = {
  LEAVE_PENDING: 'Leave request',
  LEAVE_DECIDED: 'Your leave',
  ATTENDANCE_FLAGGED: 'Flagged check-in',
  ATTENDANCE_MISSING: 'Not checked in',
  APPOINTMENT_TODAY: 'Appointments',
  DOCTOR_OCCASION: 'Doctor occasion',
};
