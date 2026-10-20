# Модуль telegram

Опциональный канал Telegram Mini App.

- `POST /api/v1/auth/telegram` — проверка `initData` (HMAC + свежесть), автосоздание
  пользователя по `telegram_id`, выдача обычной cookie-сессии.
- `POST /api/v1/telegram/webhook` — update от Bot API с secret token; `/start`
  присылает кнопку запуска Mini App. Без токена маршрут не регистрируется.
- `findTelegramChatId` — точка для `notifications`: куда отправить сообщение о брони.
- `createTelegramSender` — обёртка над Bot API для сервиса уведомлений.

Владеет таблицей `telegram_identities`. Пользователей создаёт только через
`usersService`, сессии — через `createSessionManager` из `auth`.

Переменные окружения и ручная проверка: `docs/telegram.md`.
