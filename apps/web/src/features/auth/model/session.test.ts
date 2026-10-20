import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forgetSessionOwner,
  getSessionOwner,
  hasRememberedSession,
  notifySessionEnded,
  rememberSessionOwner,
} from './session';

describe('session owner', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('помнит владельца сессии и забывает при завершении', () => {
    expect(hasRememberedSession()).toBe(false);

    rememberSessionOwner('user-1');
    expect(getSessionOwner()).toBe('user-1');
    expect(hasRememberedSession()).toBe(true);

    forgetSessionOwner();
    expect(getSessionOwner()).toBeNull();
  });

  it('оповещает текущую вкладку и другие вкладки', () => {
    const listener = vi.fn();
    window.addEventListener('staynest:session-ended', listener);

    notifySessionEnded();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(window.localStorage.getItem('staynest:session-ended')).toBeTruthy();

    window.removeEventListener('staynest:session-ended', listener);
  });
});
