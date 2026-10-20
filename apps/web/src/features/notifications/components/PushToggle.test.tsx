import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PushToggle } from './PushToggle';
import { mockApi } from '../../../test/api-mocks';

type FakeSubscription = {
  endpoint: string;
  toJSON: () => { keys: { p256dh: string; auth: string } };
  unsubscribe: ReturnType<typeof vi.fn>;
};

function fakeSubscription(): FakeSubscription {
  return {
    endpoint: 'https://fcm.googleapis.com/fake-endpoint',
    toJSON: () => ({ keys: { p256dh: 'A'.repeat(40), auth: 'B'.repeat(20) } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

function renderToggle() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <PushToggle enabled userId="user-1" />
    </QueryClientProvider>,
  );
}

function installPushMocks(): { registration: object; subscription: FakeSubscription } {
  const subscription = fakeSubscription();
  let current: FakeSubscription | null = null;
  subscription.unsubscribe = vi.fn(async () => {
    current = null;
    return true;
  });
  const registration = {
    pushManager: {
      getSubscription: vi.fn(async () => current),
      subscribe: vi.fn(async () => {
        current = subscription;
        return subscription;
      }),
    },
  };

  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      getRegistration: vi.fn(async () => registration),
      register: vi.fn(async () => registration),
      ready: Promise.resolve(registration),
    },
  });

  const notification = {
    permission: 'default',
    requestPermission: vi.fn(async () => {
      notification.permission = 'granted';
      return 'granted';
    }),
  };
  vi.stubGlobal('Notification', notification);
  Object.defineProperty(window, 'PushManager', { configurable: true, value: class {} });

  return { registration, subscription };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'serviceWorker');
  Reflect.deleteProperty(window, 'PushManager');
  window.localStorage.clear();
});

describe('переключатель push', () => {
  it('включает и выключает подписку на текущем устройстве', async () => {
    const requests: Array<{ method: string; url: string }> = [];
    mockApi({
      pushEnabled: true,
      onRequest: (url, init) => {
        if (url.includes('/me/push-subscriptions')) {
          requests.push({ method: (init?.method ?? 'GET').toUpperCase(), url });
        }
      },
    });
    const { subscription } = installPushMocks();

    renderToggle();

    const enable = await screen.findByRole('button', { name: 'Включить push' });
    await userEvent.click(enable);
    expect(await screen.findByText('Включены на этом устройстве.')).toBeInTheDocument();
    expect(requests).toEqual([{ method: 'POST', url: '/api/v1/me/push-subscriptions' }]);

    const disable = screen.getByRole('button', { name: 'Выключить на этом устройстве' });
    await userEvent.click(disable);
    expect(await screen.findByText(/Включите, чтобы узнавать/)).toBeInTheDocument();
    expect(subscription.unsubscribe).toHaveBeenCalled();
    expect(requests).toHaveLength(2);
    expect(requests[1]?.method).toBe('DELETE');
  });
});
