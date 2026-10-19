import type { Quote, QuoteGroup } from '@staynest/shared';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../../../shared/api';
import type { TranslationKey } from '../../../shared/i18n';
import { useLocale } from '../../../shared/i18n';
import { formatMoney } from '../../../shared/lib/format';
import { Skeleton } from '../../../shared/ui/Skeleton';

const ERROR_KEYS: Record<string, TranslationKey> = {
  dates_unavailable: 'booking.errors.dates_unavailable',
  min_nights_not_met: 'booking.errors.min_nights_not_met',
  max_nights_exceeded: 'booking.errors.max_nights_exceeded',
  guests_exceed_capacity: 'booking.errors.guests_exceed_capacity',
  stay_in_past: 'booking.errors.stay_in_past',
  invalid_date_range: 'booking.errors.invalid_date_range',
  network_error: 'booking.errors.network_error',
};

type QuoteIssue = { code?: string; minNights?: number };

function quoteIssue(error: unknown): QuoteIssue | undefined {
  if (!(error instanceof ApiError) || !Array.isArray(error.errors)) return undefined;

  const first = error.errors[0];
  if (typeof first !== 'object' || first === null) return undefined;
  return first as QuoteIssue;
}

function quoteErrorMessage(error: unknown, t: TFunction): string {
  const issue = quoteIssue(error);
  const code = issue?.code ?? (error instanceof ApiError ? error.code : undefined);
  const key = code ? ERROR_KEYS[code] : undefined;
  if (!key) return t('booking.quoteError');
  return issue?.minNights === undefined ? t(key) : t(key, { count: issue.minNights });
}

function groupLabel(group: QuoteGroup, t: TFunction): string {
  if (group.source === 'weekend') return t('booking.summary.weekend');
  if (group.source === 'seasonal') return group.ruleName ?? t('booking.summary.seasonal');
  return t('booking.summary.base');
}

function QuoteLines({ quote }: { quote: Quote }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const money = (value: number) => formatMoney(value, locale, quote.currency);

  return (
    <dl className="flex flex-col gap-1.5 text-small">
      {quote.groups.map((group, index) => (
        <div
          key={`${group.ruleId ?? group.source}-${index}`}
          className="flex justify-between gap-3"
        >
          <dt className="text-ink-muted">{groupLabel(group, t)}</dt>
          <dd className="text-right text-ink tabular-nums">
            {t('booking.summary.line', { count: group.nights, price: money(group.priceMinor) })}
          </dd>
        </div>
      ))}

      {quote.cleaningFeeMinor > 0 ? (
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t('booking.summary.cleaning')}</dt>
          <dd className="text-ink tabular-nums">{money(quote.cleaningFeeMinor)}</dd>
        </div>
      ) : null}

      {quote.serviceFeeMinor > 0 ? (
        <div className="flex justify-between gap-3">
          <dt className="text-ink-muted">{t('booking.summary.service')}</dt>
          <dd className="text-ink tabular-nums">{money(quote.serviceFeeMinor)}</dd>
        </div>
      ) : null}

      <div className="mt-2 flex justify-between gap-3 border-t border-border pt-3 text-body font-semibold">
        <dt>{t('booking.summary.total')}</dt>
        <dd className="text-ink tabular-nums">{money(quote.totalMinor)}</dd>
      </div>
    </dl>
  );
}

export function QuoteSummary({
  quote,
  loading,
  error,
}: {
  quote: Quote | undefined;
  loading: boolean;
  error: unknown;
}) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <section className="flex flex-col gap-2" aria-busy="true" aria-live="polite">
        <span className="sr-only">{t('booking.calculating')}</span>
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
      </section>
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-small text-danger"
      >
        {quoteErrorMessage(error, t)}
      </p>
    );
  }

  if (!quote) return null;

  return (
    <section className="flex flex-col gap-2" aria-live="polite">
      <h3 className="text-h3 text-ink">{t('booking.summary.title')}</h3>
      <QuoteLines quote={quote} />
      <p className="text-caption text-ink-muted">{t('booking.nights', { count: quote.nights })}</p>
    </section>
  );
}
