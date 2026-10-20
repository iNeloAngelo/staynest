import { BOOKING_MESSAGE_MAX } from '@staynest/shared';
import type { PublicListing } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { formatLongDate } from '../../../shared/lib/dates';
import { Button } from '../../../shared/ui/Button';
import { NumberStepper } from '../../../shared/ui/NumberStepper';
import { Skeleton } from '../../../shared/ui/Skeleton';
import { Textarea } from '../../../shared/ui/Textarea';
import { useBookingRequest } from '../model/useBookingRequest';
import { toDayPickerRange, useBookingSelection } from '../model/useBookingSelection';
import type { IsoRange } from '../model/selection';
import { BookingCalendar } from './BookingCalendar';
import { QuoteSummary } from './QuoteSummary';

function SelectedDates({ range, language }: { range: IsoRange | undefined; language: string }) {
  const { t } = useTranslation();

  return (
    <dl className="grid grid-cols-2 gap-2">
      <div className="rounded-md border border-border px-3 py-2">
        <dt className="text-caption text-ink-muted">{t('booking.checkIn')}</dt>
        <dd className="text-small font-semibold text-ink">
          {range?.from ? formatLongDate(range.from, language) : '—'}
        </dd>
      </div>
      <div className="rounded-md border border-border px-3 py-2">
        <dt className="text-caption text-ink-muted">{t('booking.checkOut')}</dt>
        <dd className="text-small font-semibold text-ink">
          {range?.to ? formatLongDate(range.to, language) : '—'}
        </dd>
      </div>
    </dl>
  );
}

function CalendarLegend() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-ink-muted" aria-hidden="true" />
        {t('booking.legend.booked')}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-ink-muted/60" aria-hidden="true" />
        {t('booking.legend.blocked')}
      </span>
    </div>
  );
}

function BookingError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-ink-muted">{t('booking.calendarError')}</p>
      <Button variant="secondary" onClick={onRetry}>
        {t('common.retry')}
      </Button>
    </div>
  );
}

function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section className="rounded-md bg-surface-2 p-3">
      <h3 className="text-small font-semibold text-ink">{t('booking.how.title')}</h3>
      <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-small text-ink-muted">
        <li>{t('booking.how.request')}</li>
        <li>{t('booking.how.reply')}</li>
        <li>{t('booking.how.reserved')}</li>
      </ol>
    </section>
  );
}

function BookingHeader({
  heading,
  minNights,
  hasRange,
  onReset,
}: {
  heading: boolean;
  minNights: number;
  hasRange: boolean;
  onReset: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        {heading ? <h2 className="text-h3 text-ink">{t('booking.title')}</h2> : null}
        <p className="mt-1 text-small text-ink-muted">
          {t('booking.minNightsHint', { count: minNights })}
        </p>
      </div>
      {hasRange ? (
        <Button variant="ghost" size="md" onClick={onReset}>
          {t('booking.clear')}
        </Button>
      ) : null}
    </div>
  );
}

type Selection = ReturnType<typeof useBookingSelection>;
type Request = ReturnType<typeof useBookingRequest>;

function BookingDatesSection({
  listing,
  selection,
  heading,
  onReset,
  onSelect,
}: {
  listing: PublicListing;
  selection: Selection;
  heading: boolean;
  onReset: () => void;
  onSelect: (date: Date) => void;
}) {
  const { t, i18n } = useTranslation();
  const { calendar, range, guests, setGuests, quote, hint } = selection;
  if (!calendar) return null;

  return (
    <>
      <BookingHeader
        heading={heading}
        minNights={calendar.minNights}
        hasRange={Boolean(range?.from)}
        onReset={onReset}
      />
      <SelectedDates range={range} language={i18n.language} />
      <BookingCalendar calendar={calendar} selected={toDayPickerRange(range)} onSelect={onSelect} />
      <CalendarLegend />

      <p role="status" aria-live="polite" className="min-h-5 text-small text-ink-muted">
        {hint ?? (selection.nights > 0 ? t('booking.nights', { count: selection.nights }) : '')}
      </p>

      <NumberStepper
        label={t('booking.guests')}
        value={guests}
        min={1}
        max={listing.maxGuests}
        onChange={setGuests}
        hint={t('booking.guestsHint', { count: listing.maxGuests })}
      />

      <QuoteSummary quote={quote.data} loading={quote.isFetching} error={quote.error} />
    </>
  );
}

function BookingSubmitSection({
  selection,
  request,
  canSubmit,
  onReset,
}: {
  selection: Selection;
  request: Request;
  canSubmit: boolean;
  onReset: () => void;
}) {
  const { t } = useTranslation();
  const { message, setMessage } = selection;

  return (
    <>
      <Textarea
        label={t('booking.message.label')}
        hint={t('booking.message.hint')}
        value={message}
        maxLength={BOOKING_MESSAGE_MAX}
        currentLength={message.length}
        showCounter
        onChange={(event) => {
          setMessage(event.target.value);
          request.clearError();
        }}
      />
      <HowItWorks />

      {!request.online ? (
        <p role="status" className="text-small text-ink-muted">
          {t('booking.offlineForm')}
        </p>
      ) : null}

      {request.error ? (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-small text-danger"
        >
          <p>{request.error}</p>
          {request.conflict ? (
            <Button variant="secondary" className="mt-2" onClick={onReset}>
              {t('booking.clear')}
            </Button>
          ) : null}
        </div>
      ) : null}

      <Button
        fullWidth
        size="lg"
        loading={request.pending}
        disabled={!canSubmit}
        onClick={request.submit}
      >
        {request.authenticated ? t('booking.submit') : t('booking.submitAnon')}
      </Button>
    </>
  );
}

function BookingPanelBody({
  listing,
  selection,
  request,
  heading,
}: {
  listing: PublicListing;
  selection: Selection;
  request: Request;
  heading: boolean;
}) {
  const canSubmit =
    Boolean(selection.quote.data) &&
    !selection.quote.isFetching &&
    !selection.quote.isError &&
    request.online;

  function reset(): void {
    selection.reset();
    request.clearError();
  }

  function selectDate(date: Date): void {
    selection.handleSelect(date);
    request.clearError();
  }

  return (
    <div className="flex flex-col gap-4">
      <BookingDatesSection
        listing={listing}
        selection={selection}
        heading={heading}
        onReset={reset}
        onSelect={selectDate}
      />
      <BookingSubmitSection
        selection={selection}
        request={request}
        canSubmit={canSubmit}
        onReset={reset}
      />
    </div>
  );
}

export function BookingPanel({
  listing,
  heading = true,
}: {
  listing: PublicListing;
  heading?: boolean;
}) {
  const selection = useBookingSelection(listing);
  const { calendarQuery } = selection;
  const request = useBookingRequest({
    listingId: listing.id,
    range: selection.range,
    guests: selection.guests,
    message: selection.message,
    ready: Boolean(selection.quote.data),
    onDatesUnavailable: () => {
      void calendarQuery.refetch();
      void selection.quote.refetch();
    },
  });

  if (calendarQuery.isPending) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-72 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    );
  }

  if (calendarQuery.isError || !selection.calendar) {
    return <BookingError onRetry={() => void calendarQuery.refetch()} />;
  }

  return (
    <BookingPanelBody listing={listing} selection={selection} request={request} heading={heading} />
  );
}
