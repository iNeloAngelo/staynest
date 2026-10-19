import { describe, expect, it } from 'vitest';
import {
  accessCookieOptions,
  generateOpaqueToken,
  hashToken,
  refreshCookieOptions,
  signAccessToken,
  verifyAccessToken,
} from './tokens';

const SECRET = 'test-secret-with-at-least-32-characters';

describe('tokens', () => {
  it('генерирует разные opaque-токены и хранит только хэш', () => {
    const first = generateOpaqueToken();
    const second = generateOpaqueToken();

    expect(first).not.toBe(second);
    expect(first.length).toBeGreaterThan(40);
    expect(hashToken(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(first)).not.toBe(first);
  });

  it('подписывает и проверяет access-токен', async () => {
    const now = new Date();
    const token = await signAccessToken(
      { sub: '00000000-0000-4000-8000-000000000001', sid: 'session-1' },
      900,
      SECRET,
      now,
    );

    await expect(verifyAccessToken(token, SECRET)).resolves.toEqual({
      sub: '00000000-0000-4000-8000-000000000001',
      sid: 'session-1',
    });
  });

  it('отклоняет токен с другим секретом', async () => {
    const token = await signAccessToken(
      { sub: 'user-1', sid: 'session-1' },
      900,
      SECRET,
      new Date(),
    );

    await expect(
      verifyAccessToken(token, 'another-secret-with-at-least-32-characters'),
    ).rejects.toThrow();
  });

  it('ставит httpOnly, SameSite=Lax и Secure только в проде', () => {
    expect(accessCookieOptions(false, 900)).toMatchObject({
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 900,
    });

    const refresh = refreshCookieOptions(true, 2_592_000);
    expect(refresh).toMatchObject({ path: '/api/v1/auth', secure: true });
  });
});
