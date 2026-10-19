import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('принимает корректный ответ', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      db: 'up',
      version: '0.1.0',
      uptime: 12,
    });

    expect(result.success).toBe(true);
  });

  it('отвергает неизвестный статус базы', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      db: 'unknown',
      version: '0.1.0',
      uptime: 12,
    });

    expect(result.success).toBe(false);
  });
});
