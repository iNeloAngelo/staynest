import { describe, expect, it } from 'vitest';
import { isPrivateApiUrl } from './cache';

describe('isPrivateApiUrl', () => {
  it('ловит /me с query, слэшем и абсолютной формой', () => {
    expect(isPrivateApiUrl('/api/v1/me')).toBe(true);
    expect(isPrivateApiUrl('/api/v1/me?x=1')).toBe(true);
    expect(isPrivateApiUrl('/api/v1/me/')).toBe(true);
    expect(isPrivateApiUrl('/api/v1/me/bookings?cursor=abc')).toBe(true);
    expect(isPrivateApiUrl('http://localhost:3100/api/v1/me')).toBe(true);
  });

  it('не трогает публичные и похожие пути', () => {
    expect(isPrivateApiUrl('/api/v1/listings')).toBe(false);
    expect(isPrivateApiUrl('/api/v1/meetings')).toBe(false);
    expect(isPrivateApiUrl('/api/v1/members')).toBe(false);
  });
});
