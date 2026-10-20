import { useEffect } from 'react';
import {
  belongsToOtherUser,
  detachPushSubscription,
  getDevicePushSubscription,
} from './push-device';

/**
 * Сессия могла истечь без явного выхода: при входе другого аккаунта в том же
 * браузере старая push-подписка не должна продолжать присылать чужие события.
 */
export function usePushOwnerGuard(userId: string | undefined): void {
  useEffect(() => {
    if (!userId) return;

    if (!belongsToOtherUser(userId)) return;

    void getDevicePushSubscription().then((subscription) => {
      if (subscription) return detachPushSubscription(subscription);
      return undefined;
    });
  }, [userId]);
}
