import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

const ISSUER = 'staynest';
const AUDIENCE = 'staynest-api';

export const ACCESS_COOKIE = 'sn_access';
export const REFRESH_COOKIE = 'sn_refresh';
export const REFRESH_COOKIE_PATH = '/api/v1/auth';

export type AccessTokenPayload = {
  sub: string;
  sid: string;
};

export type CookieOptions = {
  path: string;
  httpOnly: true;
  sameSite: 'lax';
  secure: boolean;
  maxAge: number;
};

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newFamilyId(): string {
  return randomUUID();
}

function secretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(
  payload: AccessTokenPayload,
  ttlSeconds: number,
  secret: string,
  now: Date,
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);

  return new SignJWT({ sid: payload.sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ttlSeconds)
    .sign(secretKey(secret));
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret), {
    issuer: ISSUER,
    audience: AUDIENCE,
    algorithms: ['HS256'],
    clockTolerance: 5,
  });

  if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new Error('В access-токене нет sub или sid');
  }

  return { sub: payload.sub, sid: payload.sid };
}

export function accessCookieOptions(secure: boolean, maxAgeSeconds: number): CookieOptions {
  return {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: maxAgeSeconds,
  };
}

export function refreshCookieOptions(secure: boolean, maxAgeSeconds: number): CookieOptions {
  return {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: maxAgeSeconds,
  };
}
