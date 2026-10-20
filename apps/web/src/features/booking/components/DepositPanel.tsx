import type { BookingDeposit, BookingDetail } from '@staynest/shared';
import type { TFunction } from 'i18next';
import { CheckCircle2, RotateCcw, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatDateTime } from '../../../shared/lib/dates';
import { formatMoney } from '../../../shared/lib/format';
import { useLocale } from '../../../shared/i18n';
import type { TranslationKey } from '../../../shared/i18n';
import { useOnline } from '../../../shared/lib/useOnline';
import { Button } from '../../../shared/ui';
import { useStartDeposit } from '../api/bookings-hooks';
import { bookingErrorText } from '../model/errors';

type Viewer = 'guest' | 'host';

type StatusContext = {
  deposit: BookingDeposit;
  bookingStatus: BookingDetail['status'];
  viewer: Viewer;
  t: TFunction;
  language: string;
};

type StatusView = {
  text: string;
  Icon: LucideIcon;
  tone: string;
  canPay: boolean;
};

function statusText({ deposit, bookingStatus, viewer, t, language }: StatusContext): string {
  if (deposit.status === 'succeeded') {
    return t('booking.deposit.paid', {
      date: formatDateTime(deposit.paidAt ?? deposit.dueAt, language),
    });
  }
  if (deposit.status === 'refunded') {
    return t('booking.deposit.refunded', {
      date: formatDateTime(deposit.refundedAt ?? deposit.dueAt, language),
    });
  }
  if (bookingStatus !== 'confirmed' && bookingStatus !== 'completed') {
    return t('booking.deposit.cancelled');
  }
  if (deposit.status === 'failed') {
    return viewer === 'guest'
      ? t('booking.deposit.failedGuest', { date: formatDateTime(deposit.dueAt, language) })
      : t('booking.deposit.failedHost');
  }
  return viewer === 'guest'
    ? t('booking.deposit.dueGuest', { date: formatDateTime(deposit.dueAt, language) })
    : t('booking.deposit.dueHost', { date: formatDateTime(deposit.dueAt, language) });
}

function statusView(context: StatusContext): StatusView {
  const { deposit, bookingStatus, viewer } = context;
  const canPay =
    viewer === 'guest' &&
    bookingStatus === 'confirmed' &&
    (deposit.status === 'created' || deposit.status === 'failed');

  if (deposit.status === 'succeeded') {
    return {
      text: statusText(context),
      Icon: CheckCircle2,
      tone: 'border-success/30 bg-success/8',
      canPay: false,
    };
  }
  if (deposit.status === 'refunded') {
    return {
      text: statusText(context),
      Icon: RotateCcw,
      tone: 'border-border bg-surface-2',
      canPay: false,
    };
  }
  return {
    text: statusText(context),
    Icon: Wallet,
    tone: 'border-warning/30 bg-warning/8',
    canPay,
  };
}

function openPayment(payUrl: string): void {
  // Ссылку формирует сервер, но навигацию ограничиваем своим origin:
  // будущий реальный провайдер должен быть добавлен в allowlist осознанно.
  const url = new URL(payUrl, window.location.origin);
  if (url.origin !== window.location.origin) return;
  window.location.assign(url.toString());
}

export function DepositPanel({
  booking,
  viewer,
}: {
  booking: BookingDetail;
  viewer: Viewer;
}) {
  const { t, i18n } = useTranslation();
  const { locale } = useLocale();
  const online = useOnline();
  const start = useStartDeposit();
  const deposit = booking.deposit;

  if (!deposit) return null;

  const view = statusView({
    deposit,
    bookingStatus: booking.status,
    viewer,
    t,
    language: i18n.language,
  });
  const Icon = view.Icon;

  return (
    <section className={`rounded-lg border p-4 ${view.tone}`} aria-labelledby="deposit-title">
      <h2 id="deposit-title" className="inline-flex items-center gap-2 text-h3 text-ink">
        <Icon className="size-5" aria-hidden="true" />
        {t('booking.deposit.title')}
      </h2>
      <p className="mt-2 text-h2 tabular-nums text-ink">
        {formatMoney(deposit.amountMinor, locale, deposit.currency)}
      </p>
      <p className="mt-1 text-small text-ink-muted">{view.text}</p>

      {start.isError ? (
        <p className="mt-2 text-small text-danger" role="alert">
          {bookingErrorText(start.error, t)}
        </p>
      ) : null}

      {view.canPay ? (
        <div className="mt-3 flex flex-col gap-2">
          <Button
            onClick={() =>
              start.mutate(booking.id, {
                onSuccess: (result) => openPayment(result.payUrl),
              })
            }
            disabled={!online}
            loading={start.isPending}
          >
            {deposit.status === 'failed'
              ? t('booking.deposit.retry')
              : t('booking.deposit.pay')}
          </Button>
          {!online ? (
            <p className="text-caption text-ink-muted">{t('booking.deposit.offline')}</p>
          ) : null}
        </div>
      ) : null}

      <p className="mt-3 text-caption text-ink-muted">{t('booking.deposit.note')}</p>
    </section>
  );
}

type NoticeState = 'success' | 'failed' | 'done';

const NOTICE_MESSAGES: Record<NoticeState, TranslationKey> = {
  success: 'booking.deposit.notice.success',
  failed: 'booking.deposit.notice.failed',
  done: 'booking.deposit.notice.done',
};

function noticeState(result: string, deposit: BookingDeposit | null): NoticeState | null {
  if (result === 'success') return deposit?.status === 'succeeded' ? 'success' : null;
  if (result === 'done') return deposit?.status === 'succeeded' ? null : 'done';
  if (result === 'failed') return deposit?.status === 'succeeded' ? null : 'failed';
  return null;
}

export function PaymentNotice({
  result,
  deposit,
}: {
  result: string;
  deposit: BookingDeposit | null;
}) {
  const { t } = useTranslation();
  const state = noticeState(result, deposit);

  if (!state) return null;

  const success = state === 'success';

  return (
    <section
      className={`rounded-lg border p-4 ${
        success ? 'border-success/30 bg-success/8' : 'border-warning/30 bg-warning/8'
      }`}
      role={success ? 'status' : 'alert'}
    >
      <p className="text-small font-medium text-ink">{t(NOTICE_MESSAGES[state])}</p>
    </section>
  );
}
