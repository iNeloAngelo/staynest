import type { ZodType } from 'zod';
import { AppError } from './errors';

type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

/**
 * Превращает ошибку zod в problem+json с 422 и списком полей.
 * Значения полей в ответ не попадают: только путь, код и текст ошибки.
 */
export function parseInput<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    const errors: ValidationIssue[] = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join('.'),
      code: issue.code,
      message: issue.message,
    }));

    throw new AppError({
      status: 422,
      code: 'validation_error',
      title: 'Unprocessable Entity',
      detail: 'Проверьте поля запроса.',
      errors,
    });
  }

  return result.data;
}
