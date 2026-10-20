const DEV_PAYMENT_WEBHOOK_SECRET = 'dev-only-payment-webhook-secret-change-me';

export type PaymentsConfig = {
  /** false отключает депозит целиком (бронь подтверждается без оплаты). */
  mockEnabled: boolean;
  /** Процент от total_minor, округляется вверх до копейки. */
  depositPercent: number;
  depositTtlHours: number;
  webhookSecret: string;
};

type PaymentEnv = {
  PAYMENT_MOCK_ENABLED: 'true' | 'false';
  PAYMENT_DEPOSIT_PERCENT: number;
  PAYMENT_DEPOSIT_TTL_HOURS: number;
  PAYMENT_WEBHOOK_SECRET?: string | undefined;
};

export function paymentsConfig(data: PaymentEnv): PaymentsConfig {
  return {
    mockEnabled: data.PAYMENT_MOCK_ENABLED === 'true',
    depositPercent: data.PAYMENT_DEPOSIT_PERCENT,
    depositTtlHours: data.PAYMENT_DEPOSIT_TTL_HOURS,
    webhookSecret: data.PAYMENT_WEBHOOK_SECRET?.trim() || DEV_PAYMENT_WEBHOOK_SECRET,
  };
}
