import { AppError } from '../../platform/http/errors';
import type { PasswordPolicyError } from './password';

const WEAK_PASSWORD_MESSAGES: Record<PasswordPolicyError, string> = {
  too_short: 'Пароль должен быть не короче 10 символов.',
  too_long: 'Пароль должен быть не длиннее 128 символов.',
  common: 'Этот пароль слишком распространён. Выберите другой.',
  contains_identity: 'Пароль не должен содержать email или имя.',
};

export function unauthorized(detail = 'Требуется авторизация.'): AppError {
  return new AppError({ status: 401, code: 'unauthorized', title: 'Unauthorized', detail });
}

export function invalidCredentials(): AppError {
  return new AppError({
    status: 401,
    code: 'invalid_credentials',
    title: 'Unauthorized',
    detail: 'Неверный email или пароль.',
  });
}

export function invalidRefreshToken(): AppError {
  return new AppError({
    status: 401,
    code: 'invalid_token',
    title: 'Unauthorized',
    detail: 'Сессия недействительна. Войдите заново.',
  });
}

export function invalidLinkToken(): AppError {
  return new AppError({
    status: 400,
    code: 'invalid_link_token',
    title: 'Bad Request',
    detail: 'Ссылка недействительна или истекла.',
  });
}

export function emailNotVerified(): AppError {
  return new AppError({
    status: 403,
    code: 'email_not_verified',
    title: 'Forbidden',
    detail: 'Подтвердите email, чтобы войти в аккаунт.',
  });
}

export function rateLimited(retryAfterSeconds: number): AppError {
  return new AppError({
    status: 429,
    code: 'rate_limited',
    title: 'Too Many Requests',
    detail: 'Слишком много попыток. Попробуйте позже.',
    headers: { 'retry-after': String(retryAfterSeconds) },
  });
}

export function weakPassword(error: PasswordPolicyError): AppError {
  return new AppError({
    status: 422,
    code: 'weak_password',
    title: 'Unprocessable Entity',
    detail: WEAK_PASSWORD_MESSAGES[error],
    errors: [{ path: 'password', code: error, message: WEAK_PASSWORD_MESSAGES[error] }],
  });
}

export function currentPasswordInvalid(): AppError {
  return new AppError({
    status: 400,
    code: 'current_password_invalid',
    title: 'Bad Request',
    detail: 'Текущий пароль указан неверно.',
  });
}
