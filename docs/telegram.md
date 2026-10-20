# Telegram Mini App (Сессия 19)

Второй канал на той же кодовой базе: приложение открывается из бота Telegram,
входит без пароля по `initData` и получает уведомления о бронях в чат.
Реальный бот для демо не обязателен: без токена интеграция выключена целиком,
а PWA продолжает работать как обычно.

## 1. Что включено без токена

| Возможность | Без `TELEGRAM_BOT_TOKEN` |
|---|---|
| `POST /api/v1/auth/telegram` | `503 telegram_disabled` |
| `POST /api/v1/telegram/webhook` | маршрут не регистрируется |
| Уведомления о бронях в Telegram | не отправляются |
| Mini App в браузере | открывается как обычный сайт, гостевой режим |
| Вход по email и все брони | работают |

Это осознанный fail-open для демо: отсутствие токена не ломает основной канал.
В production токен без `TELEGRAM_WEBHOOK_SECRET` считается ошибкой конфигурации:
API не стартует, чтобы не поднять открытый вебхук.

## 2. Переменные окружения

```dotenv
TELEGRAM_BOT_TOKEN=            # от @BotFather; пусто = выключено
TELEGRAM_WEBHOOK_SECRET=       # случайная строка A-Za-z0-9_-, 32–256 символов; тот же secret_token в setWebhook
TELEGRAM_INITDATA_MAX_AGE_SECONDS=900
```

Секреты не коммитятся. `.env.example` содержит только имена.

## 3. Вход по initData

1. Telegram открывает `APP_WEB_URL` во встроенном браузере и добавляет
   `window.Telegram.WebApp.initData`.
2. Web-клиент вызывает `POST /api/v1/auth/telegram` с `{ initData }`.
3. Сервер считает `secret_key = HMAC_SHA256("WebAppData", bot_token)`,
   `hash = HMAC_SHA256(data_check_string, secret_key)`, где `data_check_string` —
   все поля кроме `hash`, отсортированные по имени и склеенные через `\n`.
4. Подпись сравнивается через `timingSafeEqual`; `auth_date` проверяется на
   свежесть (по умолчанию 15 минут, максимум 1 час) и на время из будущего
   (допуск 5 минут).
5. Дубликаты полей отвергаются. Неизвестные поля внутри `user` допускаются
   (схема `passthrough`), но в профиль не попадают: подпись всё равно
   покрывает весь объект.

Любая ошибка проверки возвращает единый `401 invalid_init_data` без подробностей;
техническая причина (`bad_signature`, `auth_date_expired`, …) пишется в лог
без самого `initData`.

Аккаунт создаётся один раз по `telegram_id`:

- `users.email` обязателен, поэтому используется синтетический адрес
  `tg<telegram_id>@telegram.invalid` (домен `.invalid` зарезервирован и не
  маршрутизируется);
- `users.password_hash = NULL` — вход только через Telegram;
- `users.email_verified_at` заполняется сразу: Telegram уже подтвердил личность;
- `telegram_identities` хранит `telegram_id`, `username` и `user_id`;
- повторный вход находит ту же строку и выдаёт новую сессию, дублей нет.

Сессия — обычная httpOnly cookie (`sn_access` + `sn_refresh`), как у email-входа.
Сервер не хранит и не логирует `initData`; сам SDK Telegram держит его в
`sessionStorage` вкладки, поэтому после входа он нужен только для повторного
обмена и не попадает в наши ответы/БД.

## 4. Бот

`POST /api/v1/telegram/webhook` принимает update только с заголовком
`x-telegram-bot-api-secret-token`, равным `TELEGRAM_WEBHOOK_SECRET`.

- `/start` → приветствие и inline-кнопка `web_app` с `APP_WEB_URL`;
- остальные команды игнорируются с `200`, чтобы Telegram не повторял запрос.

Установка вебхука (когда появится реальный токен):

```bash
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'content-type: application/json' \
  -d '{
    "url": "https://<домен>/api/v1/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message"]
  }'
```

Кнопка Mini App работает только с HTTPS-доменом. Для локальной проверки логики
бота без Telegram используется Vitest с фейковым `TelegramBot`.

## 5. Уведомления

После записи in-app уведомления и Web Push сервис `notifications` ищет
`telegram_identities` пользователя и отправляет сообщение через Bot API.
Дублируются только события, где важно действие:

- `booking_requested`, `booking_confirmed`, `booking_declined`;
- `booking_cancelled`, `booking_expiring_soon`, `booking_deposit_expired`.

Текст берётся из тех же `pushMessage`-шаблонов (ru/en), кнопка ведёт в Mini App
на `/bookings/:id`. Ошибка Bot API не откатывает бронь и не блокирует in-app
уведомление: она только логируется без токена и текста.

## 6. Интерфейс

- Официальный SDK `telegram-web-app.js` лежит локально в
  `apps/web/public/telegram-web-app.js` (SHA-256
  `124BDFF7BA3FE86C8BA5143467AFEC21E020405E74ABDB92CFDDA6C0EE3B5908`) и
  подключается с `defer`. Без него Telegram не создаёт `window.Telegram.WebApp`,
  а CSP `script-src 'self'` не пускает внешний скрипт. Локальная копия заодно
  работает офлайн и не зависит от доступности telegram.org.
- `features/telegram/model/webapp.ts` — типы и безопасные обёртки над
  `window.Telegram.WebApp`.
- `TelegramSessionGate` на старте всегда обменивает `initData` на сессию
  своего Telegram-пользователя; проверять только `/me` нельзя — в общем
  браузере cookie могла остаться от предыдущего человека. При смене владельца
  приватные кэши и push-подписка очищаются.
- `TelegramShell` включает `BackButton` вне главной, `MainButton` на карточке дома
  («Забронировать» открывает панель брони), haptic feedback (кнопки shell и
  сердечко избранного) и тему Telegram (только если пользователь не выбрал тему
  вручную).
- На карточке дома `MainButton` заменяет нижнюю навигацию и мобильную панель цены
  (`data-telegram-main` → CSS `data-telegram-hide`).
- CSP Caddy: `frame-ancestors 'self' https://web.telegram.org`,
  `X-Frame-Options` убран — иначе Telegram Web не сможет открыть iframe.

## 7. Ограничения и следующий шаг

- Вход использует cookie. В мобильном клиенте Telegram это first-party контекст и
  работает. В Telegram Web (iframe на `web.telegram.org`) браузер может блокировать
  сторонние cookie; для строгой поддержки нужен bearer-режим (access/refresh в
  ответе и `Authorization` во всех запросах, включая SSE и загрузку файлов).
  Записано в Backlog.
- Реальный бот, `setWebhook` и доставка push в Telegram не проверены: нет токена.
  Логика покрыта тестами с фейковым ботом; после выдачи токена нужно прогнать
  ручной сценарий «/start → Mini App → бронь → уведомление хозяину».
- `initData` не одноразовый: Telegram переиспользует его в рамках сессии.
  Защита — короткий TTL и rate limit по IP. Одноразовые nonce сломали бы
  перезагрузку Mini App без нового initData.
- Синтетический email виден в профиле. Если это мешает демо, добавить в `UserDto`
  признак `telegram` и скрывать адрес.
