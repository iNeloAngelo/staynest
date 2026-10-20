import type { Locale, NotificationPayload, NotificationType } from '@staynest/shared';
import type { PushMessage } from './push';

type Text = { title: string; body: string };

function localeTag(locale: Locale): string {
  return locale === 'en' ? 'en-US' : 'ru-RU';
}

function parseDay(value: string): Date {
  return new Date(`${value}T12:00:00Z`);
}

function formatDay(value: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(parseDay(value));
}

function formatRange(payload: NotificationPayload, locale: Locale): string {
  return `${formatDay(payload.checkIn, locale)} — ${formatDay(payload.checkOut, locale)}`;
}

function formatTime(value: string, locale: Locale, timeZone: string): string {
  return new Intl.DateTimeFormat(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));
}

function requested(payload: NotificationPayload, locale: Locale): Text {
  const range = formatRange(payload, locale);
  if (locale === 'en') {
    return {
      title: 'New booking request',
      body: `${payload.guestName} wants to book “${payload.listingTitle}” for ${range}.`,
    };
  }

  return {
    title: 'Новая заявка',
    body: `${payload.guestName} хочет забронировать «${payload.listingTitle}»: ${range}.`,
  };
}

function confirmed(payload: NotificationPayload, locale: Locale): Text {
  const range = formatRange(payload, locale);
  if (locale === 'en') {
    return {
      title: 'Booking confirmed',
      body: `“${payload.listingTitle}” is waiting for you: ${range}.`,
    };
  }

  return {
    title: 'Бронь подтверждена',
    body: `«${payload.listingTitle}» ждёт вас: ${range}.`,
  };
}

function declined(payload: NotificationPayload, locale: Locale): Text {
  const range = formatRange(payload, locale);
  if (locale === 'en') {
    return {
      title: 'Request declined',
      body: `The host declined your request for “${payload.listingTitle}” (${range}).`,
    };
  }

  return {
    title: 'Заявка отклонена',
    body: `Хозяин отклонил заявку на «${payload.listingTitle}» (${range}).`,
  };
}

function cancelled(payload: NotificationPayload, locale: Locale): Text {
  const byGuest = payload.actorRole === 'guest';
  const range = formatRange(payload, locale);

  if (locale === 'en') {
    return byGuest
      ? {
          title: 'Guest cancelled',
          body: `${payload.guestName} cancelled the request for “${payload.listingTitle}” (${range}).`,
        }
      : {
          title: 'Booking cancelled',
          body: `The host cancelled “${payload.listingTitle}” (${range}).`,
        };
  }

  return byGuest
    ? {
        title: 'Гость отменил заявку',
        body: `${payload.guestName} отменил заявку на «${payload.listingTitle}» (${range}).`,
      }
    : {
        title: 'Бронирование отменено',
        body: `Хозяин отменил бронь «${payload.listingTitle}» (${range}).`,
      };
}

function expiringSoon(payload: NotificationPayload, locale: Locale, timeZone: string): Text {
  const until = payload.expiresAt
    ? formatTime(payload.expiresAt, locale, timeZone)
    : formatRange(payload, locale);

  if (locale === 'en') {
    return {
      title: 'Request expires soon',
      body: `Reply to the request for “${payload.listingTitle}” before ${until}.`,
    };
  }

  return {
    title: 'Заявка скоро истечёт',
    body: `Ответьте на заявку «${payload.listingTitle}» до ${until}.`,
  };
}

function expired(payload: NotificationPayload, locale: Locale): Text {
  if (locale === 'en') {
    return {
      title: 'Request expired',
      body: `The request for “${payload.listingTitle}” expired because the host did not reply.`,
    };
  }

  return {
    title: 'Заявка истекла',
    body: `Заявка на «${payload.listingTitle}» истекла: хозяин не ответил вовремя.`,
  };
}

function depositExpired(payload: NotificationPayload, locale: Locale): Text {
  const range = formatRange(payload, locale);
  if (locale === 'en') {
    return {
      title: 'Deposit not paid',
      body: `The booking for “${payload.listingTitle}” (${range}) was cancelled: the deposit was not paid on time.`,
    };
  }

  return {
    title: 'Депозит не оплачен',
    body: `Бронь «${payload.listingTitle}» (${range}) отменена: депозит не оплачен в срок.`,
  };
}

function completed(payload: NotificationPayload, locale: Locale): Text {
  if (locale === 'en') {
    return {
      title: 'Trip completed',
      body: `Your stay at “${payload.listingTitle}” is complete. We hope you enjoyed it.`,
    };
  }

  return {
    title: 'Поездка завершена',
    body: `Проживание в «${payload.listingTitle}» завершено. Надеемся, всё прошло хорошо.`,
  };
}

export function pushMessage(
  type: NotificationType,
  payload: NotificationPayload,
  locale: Locale,
  timeZone: string,
): PushMessage {
  let text: Text;

  switch (type) {
    case 'booking_requested':
      text = requested(payload, locale);
      break;
    case 'booking_confirmed':
      text = confirmed(payload, locale);
      break;
    case 'booking_declined':
      text = declined(payload, locale);
      break;
    case 'booking_cancelled':
      text = cancelled(payload, locale);
      break;
    case 'booking_expiring_soon':
      text = expiringSoon(payload, locale, timeZone);
      break;
    case 'booking_expired':
      text = expired(payload, locale);
      break;
    case 'booking_deposit_expired':
      text = depositExpired(payload, locale);
      break;
    case 'booking_completed':
      text = completed(payload, locale);
      break;
  }

  return {
    ...text,
    url: `/bookings/${payload.bookingId}`,
    tag: `booking-${payload.bookingId}`,
  };
}
