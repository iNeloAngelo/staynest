import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import { createInstance } from 'i18next';
import { notificationTypeSchema } from '@staynest/shared';
import { en } from '../../../shared/i18n/resources/en';
import { ru } from '../../../shared/i18n/resources/ru';
import { demoNotification } from '../../../test/api-mocks';
import { NOTIFICATION_META, notificationDescription, notificationHref } from './labels';

async function translator(language: 'ru' | 'en'): Promise<TFunction> {
  const instance = createInstance();
  await instance.init({
    lng: language,
    resources: { ru: { translation: ru }, en: { translation: en } },
    initAsync: false,
  });

  return instance.t.bind(instance) as TFunction;
}

describe('подписи уведомлений', () => {
  it('переводит заявку и подчёркивает пару дат', async () => {
    const notification = demoNotification();
    const ruText = notificationDescription(notification, await translator('ru'), 'ru');
    const enText = notificationDescription(notification, await translator('en'), 'en');

    expect(ruText).toContain('Анна');
    expect(ruText).toContain('Дом у озера');
    expect(ruText).toContain('—');
    expect(enText).toContain('wants to book');
  });

  it('различает отмену гостем и хозяином', async () => {
    const t = await translator('ru');
    const byGuest = demoNotification({
      type: 'booking_cancelled',
      payload: { ...demoNotification().payload, actorRole: 'guest' },
    });
    const byHost = demoNotification({
      type: 'booking_cancelled',
      payload: { ...demoNotification().payload, actorRole: 'host' },
    });

    expect(notificationDescription(byGuest, t, 'ru')).toContain('отменил заявку');
    expect(notificationDescription(byHost, t, 'ru')).toContain('Хозяин отменил');
  });

  it('ведёт на страницу брони и даёт иконку каждому типу', () => {
    const notification = demoNotification();

    expect(notificationHref(notification)).toBe(`/bookings/${notification.payload.bookingId}`);
    expect(Object.keys(NOTIFICATION_META).sort()).toEqual([...notificationTypeSchema.options].sort());
  });
});
