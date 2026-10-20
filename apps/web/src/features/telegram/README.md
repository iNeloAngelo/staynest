# Feature telegram

Оболочка Mini App поверх общего web-приложения.

- `model/webapp.ts` — типы и безопасные обёртки `window.Telegram.WebApp`
  (Telegram внедряет объект сам, внешний скрипт не нужен).
- `model/useTelegramSession.ts` — на старте проверяет `/me`, при необходимости
  обменивает `initData` на cookie-сессию. Ошибка не ломает гостевой режим.
- `components/TelegramSessionGate.tsx` — не даёт `RequireAuth` редиректнуть на
  `/login` раньше окончания обмена.
- `components/TelegramShell.tsx` — тема, `BackButton`, `MainButton` на карточке
  дома, haptic feedback.

Вне Telegram все компоненты ничего не делают.
