import type { BookingEvent } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { useLocale } from '../../../shared/i18n';
import { BookingStatusBadge } from './BookingStatusBadge';

const ACTOR_KEYS: Record<BookingEvent['actorRole'], TranslationKey> = {
  guest: 'booking.timeline.actorGuest',
  host: 'booking.timeline.actorHost',
  system: 'booking.timeline.actorSystem',
};

function formatMoment(value: string, language: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(language.startsWith('en') ? 'en-US' : 'ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function BookingTimeline({ events }: { events: BookingEvent[] }) {
  const { t } = useTranslation();
  const { locale } = useLocale();

  if (events.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-h2 text-ink">{t('booking.timeline.title')}</h2>

      <ol className="flex flex-col gap-0">
        {events.map((event, index) => (
          <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
            {index < events.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-5 bottom-0 left-[7px] w-px bg-border"
              />
            ) : null}
            <span
              aria-hidden="true"
              className="mt-1.5 size-3.5 shrink-0 rounded-full border-2 border-surface bg-primary"
            />

            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <BookingStatusBadge status={event.toStatus} />
                <span className="text-caption text-ink-muted">
                  {formatMoment(event.createdAt, locale)}
                </span>
              </div>
              <p className="text-small text-ink-muted">{t(ACTOR_KEYS[event.actorRole])}</p>
              {event.note ? (
                <p className="rounded-md bg-surface-2 px-3 py-2 text-small text-ink">
                  {event.note}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
