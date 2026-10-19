# Фича auth

Вход, регистрация и текущая сессия. Контракты берутся из `@staynest/shared`
(`loginInputSchema`, `registerInputSchema`, `UserDto`), поэтому правила полей не
дублируются на клиенте.

## Публичный интерфейс

- `useMe()` — `GET /api/v1/me`; `401` превращается в `null` (гость), сетевые ошибки
  остаются ошибками.
- `useLogin()`, `useRegister()`, `useResendVerification()`, `useVerifyEmail()`,
  `useForgotPassword()`, `useResetPassword()`, `useLogout()` — мутации TanStack Query.
  После входа пользователь кладётся в кэш `['me']`; после выхода кэш пользовательских
  запросов очищается.
- `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `TokenPasswordForm` —
  react-hook-form + zod, ошибки сервера переводятся по полю `code` problem+json.
- `InvalidLink`, `AuthSuccess` — состояния ссылок из писем.
- `safeNext()` — пропускает только локальные пути (`/...`), защита от open redirect.
- `authErrorKey()` — стабильный маппинг кодов API на ключи i18n.

## Страницы

`/login`, `/register`, `/verify-email?token=…`, `/forgot-password`,
`/reset-password?token=…`. Последние три добавлены в Сессии 4, потому что иначе
ссылки из писем Сессии 3 вели на 404 (ADR-041). Подтверждение email и сброс пароля
не создают сессию: после успеха пользователь входит заново.

## Сессия

Токены живут в httpOnly cookie `sn_access` (15 мин) и `sn_refresh` (30 дней).
`shared/api` при `401` делает **один** refresh на все параллельные запросы
(single-flight) и повторяет исходный запрос. Два одновременных refresh с одним
cookie API считает повторным использованием и отзывает family, поэтому клиент
обязан их сериализовать.

## Как тестировать

```bash
pnpm --filter @staynest/web test
```

Ручной сценарий: `pnpm dev`, открыть `/register`, создать аккаунт. При
`REQUIRE_EMAIL_VERIFICATION=true` открыть письмо в Mailpit, перейти по ссылке на
`/verify-email`, задать пароль и войти. При `false` вход доступен сразу.
Dev-сервер должен открываться по `http://localhost:5173` (или origin должен быть
в `CORS_ORIGINS`), иначе API вернёт `403 origin_not_allowed`.
