import { useCallback, useEffect, useState } from 'react';
import type { PushSubscriptionInput } from '@staynest/shared';
import { usePushConfig, usePushSubscriptionMutation } from '../api/hooks';
import {
  belongsToOtherUser,
  detachPushSubscription,
  getDevicePushSubscription,
  rememberPushOwner,
} from './push-device';

export type PushStatus =
  'unsupported' | 'unavailable' | 'configError' | 'denied' | 'off' | 'on' | 'busy';

type PushErrorKey =
  | 'notifications.push.errorDenied'
  | 'notifications.push.errorUnavailable'
  | 'notifications.push.errorGeneric';

export type PushToggle = {
  status: PushStatus;
  errorKey: PushErrorKey | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  unsubscribeCurrentDevice: () => Promise<void>;
};

type Subscribe = (input: PushSubscriptionInput) => Promise<unknown>;

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

function keysOf(subscription: PushSubscription): { p256dh: string; auth: string } | null {
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  return p256dh && auth ? { p256dh, auth } : null;
}

async function subscribeCurrentDevice(
  publicKey: string,
  subscribe: Subscribe,
): Promise<PushErrorKey | null> {
  const permission =
    Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;

  if (permission !== 'granted') return 'notifications.push.errorDenied';

  const registration = await navigator.serviceWorker.register(
    import.meta.env.DEV ? '/push-sw.js' : '/sw.js',
  );
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey),
    }));

  const keys = keysOf(subscription);
  if (!keys) {
    await subscription.unsubscribe();
    return 'notifications.push.errorGeneric';
  }

  await subscribe({ endpoint: subscription.endpoint, keys, userAgent: navigator.userAgent });
  return null;
}

function statusOf(input: {
  isSupported: boolean;
  initializing: boolean;
  configPending: boolean;
  configError: boolean;
  configEnabled: boolean | undefined;
  subscription: PushSubscription | null;
  busy: boolean;
}): PushStatus {
  if (!input.isSupported) return 'unsupported';
  if (input.initializing || input.configPending) return 'busy';
  if (input.configError) return 'configError';
  if (input.configEnabled === false) return 'unavailable';
  if (Notification.permission === 'denied') return 'denied';
  if (input.busy) return 'busy';
  return input.subscription ? 'on' : 'off';
}

function usePushDetection(enabled: boolean, isSupported: boolean, userId: string) {
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [initializing, setInitializing] = useState(enabled && isSupported);

  useEffect(() => {
    if (!enabled || !isSupported) {
      setInitializing(false);
      return;
    }

    let cancelled = false;

    async function detect(): Promise<void> {
      const existing = await getDevicePushSubscription();
      if (cancelled) return;

      if (existing && belongsToOtherUser(userId)) {
        await detachPushSubscription(existing);
        if (!cancelled) setSubscription(null);
      } else {
        setSubscription(existing);
      }

      if (!cancelled) setInitializing(false);
    }

    void detect();

    return () => {
      cancelled = true;
    };
  }, [enabled, isSupported, userId]);

  return { subscription, setSubscription, initializing };
}

export function usePushToggle(enabled: boolean, userId: string): PushToggle {
  const config = usePushConfig(enabled);
  const subscribeMutation = usePushSubscriptionMutation();
  const isSupported = supported();
  const { subscription, setSubscription, initializing } = usePushDetection(
    enabled,
    isSupported,
    userId,
  );
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<PushErrorKey | null>(null);

  const enable = useCallback(async (): Promise<void> => {
    setErrorKey(null);
    setBusy(true);

    try {
      if (!isSupported) return setErrorKey('notifications.push.errorGeneric');
      if (!config.data?.enabled || !config.data.publicKey) {
        return setErrorKey('notifications.push.errorUnavailable');
      }

      const error = await subscribeCurrentDevice(config.data.publicKey, (input) =>
        subscribeMutation.mutateAsync(input),
      );
      if (error) return setErrorKey(error);

      rememberPushOwner(userId);
      setSubscription(await getDevicePushSubscription());
    } catch {
      setErrorKey('notifications.push.errorGeneric');
    } finally {
      setBusy(false);
    }
  }, [config.data, isSupported, setSubscription, subscribeMutation, userId]);

  const unsubscribeCurrentDevice = useCallback(async (): Promise<void> => {
    const current = subscription ?? (await getDevicePushSubscription());
    if (!current) return;

    await detachPushSubscription(current);
    setSubscription(null);
  }, [subscription, setSubscription]);

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true);
    setErrorKey(null);
    await unsubscribeCurrentDevice();
    setBusy(false);
  }, [unsubscribeCurrentDevice]);

  const status = statusOf({
    isSupported,
    initializing,
    configPending: config.isPending,
    configError: config.isError,
    configEnabled: config.data?.enabled,
    subscription,
    busy,
  });

  return { status, errorKey, enable, disable, unsubscribeCurrentDevice };
}
