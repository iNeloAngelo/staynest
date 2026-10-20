import { z } from 'zod';

export const paymentStatusSchema = z.enum(['created', 'succeeded', 'failed', 'refunded']);
export const paymentKindSchema = z.enum(['deposit', 'refund']);

/**
 * Состояние депозита в брони. Деньги и срок считает сервер; клиент только
 * показывает сумму и дату, а оплату открывает по одноразовой ссылке провайдера.
 */
export const bookingDepositSchema = z.object({
  status: paymentStatusSchema,
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  dueAt: z.iso.datetime(),
  paidAt: z.iso.datetime().nullable(),
  refundedAt: z.iso.datetime().nullable(),
});

export const paymentDtoSchema = z.object({
  id: z.uuid(),
  bookingId: z.uuid(),
  provider: z.string(),
  kind: paymentKindSchema,
  status: paymentStatusSchema,
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const depositPaymentResponseSchema = z.object({
  payment: paymentDtoSchema,
  /** Относительный адрес hosted-страницы провайдера. */
  payUrl: z.string().min(1),
});

/** Событие мок-провайдера. Строгая схема: карточные поля отвергаются. */
export const mockPaymentWebhookSchema = z
  .object({
    externalId: z.string().min(8).max(200),
    status: z.enum(['succeeded', 'failed']),
    amountMinor: z.number().int().positive(),
    currency: z.string().length(3),
    occurredAt: z.iso.datetime(),
  })
  .strict();

export const paymentWebhookResponseSchema = z.object({
  received: z.literal(true),
  replayed: z.boolean(),
});

export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
export type PaymentKind = z.infer<typeof paymentKindSchema>;
export type BookingDeposit = z.infer<typeof bookingDepositSchema>;
export type PaymentDto = z.infer<typeof paymentDtoSchema>;
export type DepositPaymentResponse = z.infer<typeof depositPaymentResponseSchema>;
export type MockPaymentWebhook = z.infer<typeof mockPaymentWebhookSchema>;
export type PaymentWebhookResponse = z.infer<typeof paymentWebhookResponseSchema>;
