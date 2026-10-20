import { z } from 'zod';
import { isoDateSchema } from './pricing';

export const DASHBOARD_DEFAULT_MONTHS = 6;
export const DASHBOARD_MAX_MONTHS = 12;
export const DASHBOARD_OCCUPANCY_DAYS = 30;
export const DASHBOARD_UPCOMING_LIMIT = 5;

export const dashboardQuerySchema = z
  .object({
    months: z.coerce
      .number()
      .int()
      .min(1)
      .max(DASHBOARD_MAX_MONTHS)
      .default(DASHBOARD_DEFAULT_MONTHS),
  })
  .strict();

/** Ближайший подтверждённый заезд: контакты и адрес здесь не нужны. */
export const dashboardCheckInSchema = z.object({
  bookingId: z.uuid(),
  listingId: z.uuid(),
  listingTitle: z.string(),
  city: z.string().nullable(),
  guestName: z.string(),
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  guestsCount: z.number().int(),
});

/**
 * Занятость окна `[from, to)` считается в ночах: подтверждённые брони плюс
 * блокировки хозяина. Заявки `pending` показаны отдельным счётчиком, потому
 * что даты они резервируют, но ещё не являются подтверждённым доходом.
 */
export const dashboardOccupancySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  totalNights: z.number().int(),
  bookedNights: z.number().int(),
  blockedNights: z.number().int(),
  occupiedNights: z.number().int(),
  percent: z.number().int(),
});

/** Доход подтверждённых и завершённых броней по месяцу заезда. */
export const dashboardRevenueMonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  totalMinor: z.number().int(),
  bookings: z.number().int(),
});

export const dashboardRevenueSchema = z.object({
  currency: z.string(),
  months: z.array(dashboardRevenueMonthSchema),
});

export const dashboardResponseSchema = z.object({
  today: isoDateSchema,
  pendingRequests: z.number().int(),
  upcomingCheckIns: z.array(dashboardCheckInSchema),
  occupancy: dashboardOccupancySchema,
  revenue: dashboardRevenueSchema,
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type DashboardCheckIn = z.infer<typeof dashboardCheckInSchema>;
export type DashboardOccupancy = z.infer<typeof dashboardOccupancySchema>;
export type DashboardRevenueMonth = z.infer<typeof dashboardRevenueMonthSchema>;
export type DashboardRevenue = z.infer<typeof dashboardRevenueSchema>;
export type DashboardResponse = z.infer<typeof dashboardResponseSchema>;
