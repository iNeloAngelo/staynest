import { describe, expect, it } from 'vitest';
import { statusCodeFor } from './errors';

describe('код ошибки по HTTP-статусу', () => {
  it('возвращает машинные коды для не-JSON ответов', () => {
    expect(statusCodeFor(413)).toBe('payload_too_large');
    expect(statusCodeFor(415)).toBe('unsupported_media_type');
    expect(statusCodeFor(429)).toBe('rate_limited');
    expect(statusCodeFor(599)).toBe('http_error');
  });
});
