import { AppError } from '../../../platform/http/errors';

export function paymentNotFound(): AppError {
  return new AppError({
    status: 404,
    code: 'payment_not_found',
    title: 'Not Found',
    detail: 'Платёж не найден.',
  });
}

export function paymentForbidden(): AppError {
  return new AppError({
    status: 403,
    code: 'payment_forbidden',
    title: 'Forbidden',
    detail: 'Оплатить депозит может только гость этой брони.',
  });
}

export function depositUnavailable(): AppError {
  return new AppError({
    status: 409,
    code: 'deposit_unavailable',
    title: 'Conflict',
    detail: 'Депозит доступен только для подтверждённой брони.',
  });
}

export function depositAlreadyPaid(): AppError {
  return new AppError({
    status: 409,
    code: 'deposit_already_paid',
    title: 'Conflict',
    detail: 'Депозит уже оплачен.',
  });
}

export function depositExpired(): AppError {
  return new AppError({
    status: 409,
    code: 'deposit_expired',
    title: 'Conflict',
    detail: 'Срок оплаты депозита истёк. Бронь будет отменена.',
  });
}

export function invalidPaymentSignature(): AppError {
  return new AppError({
    status: 401,
    code: 'payment_signature_invalid',
    title: 'Unauthorized',
    detail: 'Подпись вебхука неверна.',
  });
}

export function invalidPaymentPayload(): AppError {
  return new AppError({
    status: 400,
    code: 'payment_payload_invalid',
    title: 'Bad Request',
    detail: 'Тело вебхука не соответствует формату платежа.',
  });
}

export function paymentWebhookConflict(): AppError {
  return new AppError({
    status: 409,
    code: 'payment_webhook_conflict',
    title: 'Conflict',
    detail: 'Для этого платежа уже обработано другое событие.',
  });
}
