import { api } from '@/api/client';
import type { ApiSuccess } from '@/types';

export type NotificationKind =
  | 'LEAVE_PENDING'
  | 'LEAVE_DECIDED'
  | 'ATTENDANCE_FLAGGED'
  | 'ATTENDANCE_MISSING'
  | 'APPOINTMENT_TODAY'
  | 'VISIT_FOLLOWUP'
  | 'STOCK_EXPIRY'
  | 'DOCTOR_OCCASION'
  | 'REGULARIZATION_PENDING'
  | 'REGULARIZATION_DECIDED'
  | 'EXPENSE_PENDING'
  | 'EXPENSE_DECIDED'
  | 'EXPENSE_PAID';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  href: string;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  at: string | null;
  count?: number;
  /** Only db-backed items (`db-<id>`) carry read state. */
  readAt?: string | null;
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
  /** Marks one stored (`db-<id>`) notification read; derived items are immutable. */
  async markRead(id: string): Promise<void> {
    await api.patch(`/notifications/${id}/read`);
  },
  async markAllRead(): Promise<void> {
    await api.post('/notifications/read-all');
  },
};

/** True for persisted rows that can be marked read. */
export function isStoredNotification(item: AppNotification): boolean {
  return item.id.startsWith('db-');
}

export function isUnread(item: AppNotification): boolean {
  return isStoredNotification(item) && !item.readAt;
}

/** Kinds that represent work waiting on the signed-in user. */
export const ACTIONABLE_KINDS: NotificationKind[] = [
  'LEAVE_PENDING',
  'ATTENDANCE_FLAGGED',
  'ATTENDANCE_MISSING',
  'REGULARIZATION_PENDING',
  'EXPENSE_PENDING',
];

/** Badge count: unread stored items + live derived action items. */
export function countActionable(feed: NotificationFeed | undefined): number {
  if (!feed) return 0;
  return feed.items.filter(
    (item) =>
      isUnread(item) ||
      (!isStoredNotification(item) && ACTIONABLE_KINDS.includes(item.kind)),
  ).length;
}

export const NOTIFICATION_LABEL: Partial<Record<NotificationKind, string>> = {
  LEAVE_PENDING: 'Leave request',
  LEAVE_DECIDED: 'Your leave',
  ATTENDANCE_FLAGGED: 'Flagged check-in',
  ATTENDANCE_MISSING: 'Not checked in',
  APPOINTMENT_TODAY: 'Appointments',
  DOCTOR_OCCASION: 'Doctor occasion',
  REGULARIZATION_PENDING: 'Regularization',
  REGULARIZATION_DECIDED: 'Your regularization',
  EXPENSE_PENDING: 'Expense claim',
  EXPENSE_DECIDED: 'Your expense',
  EXPENSE_PAID: 'Expense paid',
};
