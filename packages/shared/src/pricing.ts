import { z } from 'zod';
import { addDays, isIsoDate, nightsBetween } from './dates';
import { MAX_MONEY_MINOR } from './listings';

export const MAX_CALENDAR_DAYS = 400;
export const MAX_BLOCK_DAYS = 366;
export const MAX_QUOTE_NIGHTS = 365;
export const MAX_PRICE_RULE_DAYS = 3660;

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата указывается как ГГГГ-ММ-ДД.')
  .refine(isIsoDate, 'Такой даты не существует.');

/** ТЗ использует `check_in`/`check_out`, web — camelCase. Принимаем оба варианта. */
function withDateAliases(input: unknown): unknown {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return input;

  const source = { ...(input as Record<string, unknown>) };
  if (source.checkIn === undefined && source.check_in !== undefined)
    source.checkIn = source.check_in;
  if (source.checkOut === undefined && source.check_out !== undefined)
    source.checkOut = source.check_out;
  delete source.check_in;
  delete source.check_out;
  return source;
}

export const quoteQuerySchema = z.preprocess(
  withDateAliases,
  z
    .object({
      checkIn: isoDateSchema,
      checkOut: isoDateSchema,
      guests: z.coerce.number().int().min(1).max(30),
    })
    .refine((value) => value.checkOut > value.checkIn, {
      path: ['checkOut'],
      message: 'Дата выезда должна быть позже даты заезда.',
    })
    .refine(
      (value) =>
        value.checkOut <= value.checkIn ||
        nightsBetween(value.checkIn, value.checkOut) <= MAX_QUOTE_NIGHTS,
      {
        path: ['checkOut'],
        message: `Максимальный срок — ${MAX_QUOTE_NIGHTS} ночей.`,
      },
    ),
);

export const calendarQuerySchema = z
  .object({
    from: isoDateSchema,
    to: isoDateSchema,
  })
  .refine((value) => value.from < value.to, {
    path: ['to'],
    message: 'Дата окончания должна быть позже начала.',
  })
  .refine((value) => nightsBetween(value.from, value.to) <= MAX_CALENDAR_DAYS, {
    path: ['to'],
    message: `За один запрос можно получить не больше ${MAX_CALENDAR_DAYS} дней.`,
  });

export const calendarNightKindSchema = z.enum(['booked', 'blocked']);

export const calendarResponseSchema = z.object({
  listingId: z.uuid(),
  from: isoDateSchema,
  to: isoDateSchema,
  /** Сегодняшняя дата по таймзоне объявления: клиент не угадывает её из часов устройства. */
  today: isoDateSchema,
  minNights: z.number().int(),
  maxNights: z.number().int(),
  basePriceMinor: z.number().int(),
  weekendPriceMinor: z.number().int().nullable(),
  cleaningFeeMinor: z.number().int(),
  currency: z.string(),
  unavailable: z.array(
    z.object({
      date: isoDateSchema,
      kind: calendarNightKindSchema,
    }),
  ),
});

export const bookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'declined',
  'cancelled_by_guest',
  'cancelled_by_host',
  'expired',
  'completed',
]);

export const blockInputSchema = z
  .object({
    /** Первая заблокированная ночь. */
    dateFrom: isoDateSchema,
    /** Последняя заблокированная ночь включительно. */
    dateTo: isoDateSchema,
    reason: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
      z.string().trim().max(200, 'Причина не длиннее 200 символов.').optional(),
    ),
  })
  .refine((value) => value.dateFrom <= value.dateTo, {
    path: ['dateTo'],
    message: 'Дата окончания не может быть раньше начала.',
  })
  .refine(
    (value) =>
      value.dateTo < value.dateFrom ||
      nightsBetween(value.dateFrom, addDays(value.dateTo, 1)) <= MAX_BLOCK_DAYS,
    {
      path: ['dateTo'],
      message: `Одна блокировка — не больше ${MAX_BLOCK_DAYS} ночей.`,
    },
  );

export const blockDtoSchema = z.object({
  id: z.uuid(),
  listingId: z.uuid(),
  dateFrom: isoDateSchema,
  dateTo: isoDateSchema,
  reason: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export const blocksResponseSchema = z.object({ blocks: z.array(blockDtoSchema) });
export const blockResponseSchema = z.object({ block: blockDtoSchema });

export const hostCalendarBookingSchema = z.object({
  id: z.uuid(),
  status: bookingStatusSchema,
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  guestName: z.string(),
});

export const hostCalendarResponseSchema = z.object({
  listingId: z.uuid(),
  from: isoDateSchema,
  to: isoDateSchema,
  today: isoDateSchema,
  bookings: z.array(hostCalendarBookingSchema),
  blocks: z.array(blockDtoSchema),
});

const priceRuleFields = {
  name: z.string().trim().min(1, 'Название обязательно.').max(100),
  dateFrom: isoDateSchema,
  dateTo: isoDateSchema,
  nightlyPriceMinor: z.number().int().min(1).max(MAX_MONEY_MINOR),
  minNights: z.number().int().min(1).max(365).nullable().optional(),
  priority: z.number().int().min(-1000).max(1000).optional(),
};

const priceRulePeriod = (value: { dateFrom: string; dateTo: string }) =>
  value.dateTo >= value.dateFrom;
const priceRuleLength = (value: { dateFrom: string; dateTo: string }) =>
  value.dateTo < value.dateFrom ||
  nightsBetween(value.dateFrom, addDays(value.dateTo, 1)) <= MAX_PRICE_RULE_DAYS;
const priceRulePeriodMessage = {
  path: ['dateTo'],
  message: 'Дата окончания не может быть раньше начала.',
};
const priceRuleLengthMessage = {
  path: ['dateTo'],
  message: `Правило не может быть длиннее ${MAX_PRICE_RULE_DAYS} дней.`,
};

export const priceRuleInputSchema = z
  .object(priceRuleFields)
  .refine(priceRulePeriod, priceRulePeriodMessage)
  .refine(priceRuleLength, priceRuleLengthMessage);

export const priceRulePatchSchema = z
  .object({
    name: priceRuleFields.name.optional(),
    dateFrom: priceRuleFields.dateFrom.optional(),
    dateTo: priceRuleFields.dateTo.optional(),
    nightlyPriceMinor: priceRuleFields.nightlyPriceMinor.optional(),
    minNights: priceRuleFields.minNights,
    priority: priceRuleFields.priority,
  })
  .refine((value) => Object.keys(value).length > 0, 'Нужно передать хотя бы одно поле.')
  .refine(
    (value) =>
      value.dateFrom === undefined || value.dateTo === undefined || value.dateTo >= value.dateFrom,
    priceRulePeriodMessage,
  )
  .refine(
    (value) =>
      value.dateFrom === undefined ||
      value.dateTo === undefined ||
      priceRuleLength({ dateFrom: value.dateFrom, dateTo: value.dateTo }),
    priceRuleLengthMessage,
  );

export const priceRuleDtoSchema = z.object({
  id: z.uuid(),
  listingId: z.uuid(),
  name: z.string(),
  dateFrom: isoDateSchema,
  dateTo: isoDateSchema,
  nightlyPriceMinor: z.number().int(),
  minNights: z.number().int().nullable(),
  priority: z.number().int(),
  createdAt: z.iso.datetime(),
});

export const priceRulesResponseSchema = z.object({ priceRules: z.array(priceRuleDtoSchema) });
export const priceRuleResponseSchema = z.object({ priceRule: priceRuleDtoSchema });

export const quoteNightSourceSchema = z.enum(['seasonal', 'weekend', 'base']);

export const quoteNightSchema = z.object({
  date: isoDateSchema,
  priceMinor: z.number().int(),
  source: quoteNightSourceSchema,
  ruleId: z.uuid().nullable(),
});

export const quoteGroupSchema = z.object({
  priceMinor: z.number().int(),
  nights: z.number().int(),
  source: quoteNightSourceSchema,
  ruleId: z.uuid().nullable(),
  ruleName: z.string().nullable(),
});

export const quoteSchema = z.object({
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  nights: z.number().int(),
  guests: z.number().int(),
  currency: z.string(),
  minNightsApplied: z.number().int(),
  maxNights: z.number().int(),
  nightly: z.array(quoteNightSchema),
  groups: z.array(quoteGroupSchema),
  nightlyTotalMinor: z.number().int(),
  cleaningFeeMinor: z.number().int(),
  serviceFeeMinor: z.number().int(),
  totalMinor: z.number().int(),
});

export const quoteResponseSchema = z.object({ quote: quoteSchema });

export type QuoteQuery = z.infer<typeof quoteQuerySchema>;
export type CalendarQuery = z.infer<typeof calendarQuerySchema>;
export type CalendarNightKind = z.infer<typeof calendarNightKindSchema>;
export type CalendarResponse = z.infer<typeof calendarResponseSchema>;
export type BookingStatus = z.infer<typeof bookingStatusSchema>;
export type BlockInput = z.infer<typeof blockInputSchema>;
export type BlockDto = z.infer<typeof blockDtoSchema>;
export type BlocksResponse = z.infer<typeof blocksResponseSchema>;
export type BlockResponse = z.infer<typeof blockResponseSchema>;
export type HostCalendarBooking = z.infer<typeof hostCalendarBookingSchema>;
export type HostCalendarResponse = z.infer<typeof hostCalendarResponseSchema>;
export type PriceRuleInput = z.infer<typeof priceRuleInputSchema>;
export type PriceRulePatch = z.infer<typeof priceRulePatchSchema>;
export type PriceRuleDto = z.infer<typeof priceRuleDtoSchema>;
export type PriceRulesResponse = z.infer<typeof priceRulesResponseSchema>;
export type PriceRuleResponse = z.infer<typeof priceRuleResponseSchema>;
export type QuoteNightSource = z.infer<typeof quoteNightSourceSchema>;
export type QuoteNight = z.infer<typeof quoteNightSchema>;
export type QuoteGroup = z.infer<typeof quoteGroupSchema>;
export type Quote = z.infer<typeof quoteSchema>;
export type QuoteResponse = z.infer<typeof quoteResponseSchema>;
