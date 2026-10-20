import { unsubscribeFromPush } from '../api/notifications';

const PUSH_OWNER_KEY = 'staynest:push-owner';

function pushOwner(): string | null {
  try {
    return window.localStorage.getItem(PUSH_OWNER_KEY);
  } catch {
    return null;
  }
}

export function rememberPushOwner(userId: string): void {
  try {
    window.localStorage.setItem(PUSH_OWNER_KEY, userId);
  } catch {
    // Приватный режим может запрещать localStorage: подписка всё равно работает.
  }
}

function forgetPushOwner(): void {
  try {
    window.localStorage.removeItem(PUSH_OWNER_KEY);
  } catch {
    // Ничего не делаем: ключ нужен только для подсказки владельца.
  }
}

export async function getDevicePushSubscription(): Promise<PushSubscription | null> {
  if (
    typeof window === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Отписка текущего устройства. Серверную запись удаляем best-effort:
 * если API недоступен, мёртвый endpoint удалится при первой отправке (404/410).
 */
export async function detachPushSubscription(subscription: PushSubscription): Promise<void> {
  try {
    await unsubscribeFromPush(subscription.endpoint);
  } catch {
    // Локальную подписку всё равно убираем чуть ниже.
  }

  try {
    await subscription.unsubscribe();
  } catch {
    // Браузер мог уже отозвать подписку сам.
  }

  forgetPushOwner();
}

/** Подписка осталась от другого аккаунта или неизвестного владельца. */
export function belongsToOtherUser(userId: string): boolean {
  const owner = pushOwner();
  return owner === null || owner !== userId;
}

/** Best-effort отписка перед выходом из аккаунта: чужие push не должны приходить. */
export async function detachCurrentDevicePush(): Promise<void> {
  const subscription = await getDevicePushSubscription();
  if (subscription) await detachPushSubscription(subscription);
}
