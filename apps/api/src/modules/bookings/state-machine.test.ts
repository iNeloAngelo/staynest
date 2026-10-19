import { describe, expect, it } from 'vitest';
import type { BookingStatus } from '@staynest/shared';
import { resolveTransition, transitionRequiresReason } from './state-machine';
import type { BookingAction, BookingActorRole } from './state-machine';

const STATUSES: BookingStatus[] = [
  'pending',
  'confirmed',
  'declined',
  'cancelled_by_guest',
  'cancelled_by_host',
  'expired',
  'completed',
];
const ACTIONS: BookingAction[] = ['confirm', 'decline', 'cancel'];
const ROLES: BookingActorRole[] = ['guest', 'host'];

const EXPECTED: Array<{
  action: BookingAction;
  from: BookingStatus;
  role: BookingActorRole;
  to: BookingStatus;
}> = [
  { action: 'confirm', from: 'pending', role: 'host', to: 'confirmed' },
  { action: 'decline', from: 'pending', role: 'host', to: 'declined' },
  { action: 'cancel', from: 'pending', role: 'guest', to: 'cancelled_by_guest' },
  { action: 'cancel', from: 'confirmed', role: 'guest', to: 'cancelled_by_guest' },
  { action: 'cancel', from: 'confirmed', role: 'host', to: 'cancelled_by_host' },
];

function key(action: string, from: string, role: string): string {
  return `${action}:${from}:${role}`;
}

const allowed = new Set(EXPECTED.map((item) => key(item.action, item.from, item.role)));

describe('state machine брони', () => {
  it('разрешает ровно пять переходов из таблицы', () => {
    for (const action of ACTIONS) {
      for (const from of STATUSES) {
        for (const role of ROLES) {
          const target = resolveTransition(action, from, role);
          const expected = EXPECTED.find(
            (item) => item.action === action && item.from === from && item.role === role,
          );

          if (allowed.has(key(action, from, role))) {
            expect(target, `${action} ${from} ${role}`).toBe(expected?.to);
          } else {
            expect(target, `${action} ${from} ${role}`).toBeNull();
          }
        }
      }
    }
  });

  it('гость не подтверждает и не отклоняет заявку', () => {
    expect(resolveTransition('confirm', 'pending', 'guest')).toBeNull();
    expect(resolveTransition('decline', 'pending', 'guest')).toBeNull();
  });

  it('хозяин не отменяет pending через cancel', () => {
    expect(resolveTransition('cancel', 'pending', 'host')).toBeNull();
  });

  it('из завершённых статусов переходов нет', () => {
    for (const status of ['declined', 'expired', 'completed', 'cancelled_by_guest'] as const) {
      for (const action of ACTIONS) {
        for (const role of ROLES) {
          expect(resolveTransition(action, status, role)).toBeNull();
        }
      }
    }
  });

  it('требует причину только при отмене хозяином', () => {
    expect(transitionRequiresReason('cancelled_by_host')).toBe(true);
    expect(transitionRequiresReason('cancelled_by_guest')).toBe(false);
    expect(transitionRequiresReason('confirmed')).toBe(false);
  });
});
