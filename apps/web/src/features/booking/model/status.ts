import type { BookingStatus } from '@staynest/shared';
import { Ban, CheckCircle2, Clock, Flag, TimerOff, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { TranslationKey } from '../../../shared/i18n';

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export type StatusMeta = {
  tone: StatusTone;
  icon: LucideIcon;
  labelKey: TranslationKey;
};

const STATUS_META: Record<BookingStatus, StatusMeta> = {
  pending: { tone: 'warning', icon: Clock, labelKey: 'booking.status.pending' },
  confirmed: { tone: 'success', icon: CheckCircle2, labelKey: 'booking.status.confirmed' },
  declined: { tone: 'danger', icon: XCircle, labelKey: 'booking.status.declined' },
  cancelled_by_guest: { tone: 'neutral', icon: Ban, labelKey: 'booking.status.cancelled_by_guest' },
  cancelled_by_host: { tone: 'neutral', icon: Ban, labelKey: 'booking.status.cancelled_by_host' },
  expired: { tone: 'neutral', icon: TimerOff, labelKey: 'booking.status.expired' },
  completed: { tone: 'info', icon: Flag, labelKey: 'booking.status.completed' },
};

export function statusMeta(status: BookingStatus): StatusMeta {
  return STATUS_META[status];
}

export type TripTab = 'upcoming' | 'past' | 'cancelled';

export const TRIP_TABS: TripTab[] = ['upcoming', 'past', 'cancelled'];

const TAB_STATUSES: Record<TripTab, BookingStatus[]> = {
  upcoming: ['pending', 'confirmed'],
  past: ['completed'],
  cancelled: ['declined', 'expired', 'cancelled_by_guest', 'cancelled_by_host'],
};

export function statusesOf(tab: TripTab): BookingStatus[] {
  return TAB_STATUSES[tab];
}

export type HostTab = 'pending' | 'confirmed' | 'completed' | 'closed';

export const HOST_TABS: HostTab[] = ['pending', 'confirmed', 'completed', 'closed'];

const HOST_TAB_STATUSES: Record<HostTab, BookingStatus[]> = {
  pending: ['pending'],
  confirmed: ['confirmed'],
  completed: ['completed'],
  closed: ['declined', 'expired', 'cancelled_by_guest', 'cancelled_by_host'],
};

export function hostStatusesOf(tab: HostTab): BookingStatus[] {
  return HOST_TAB_STATUSES[tab];
}

export function canGuestCancel(status: BookingStatus): boolean {
  return status === 'pending' || status === 'confirmed';
}

export function canHostDecide(status: BookingStatus): boolean {
  return status === 'pending';
}

export function canHostCancel(status: BookingStatus): boolean {
  return status === 'confirmed';
}
