# StayNest

PWA для аренды домов: хозяин создаёт объявление и управляет календарём, гость ищет свободные даты и отправляет заявку на бронирование. Один аккаунт, два режима — «Я ищу» и «Я сдаю».

Живой стенд: https://olivertwist95.clodocd.com

Проект собирается по сессиям: план и правила лежат в `docs/SESSIONS.md` и `AGENTS.md`.

## Стек

- **Монорепо:** pnpm workspaces, Node.js 24, TypeScript strict.
- **API:** Fastify, zod, Kysely + pg, node-pg-migrate, pg-boss, pino.
- **Web:** React, Vite, React Router, TanStack Query, Tailwind CSS, i18next.
- **Инфраструктура:** PostgreSQL 16, S3-совместимое хранилище Silo (форк MinIO, см. ADR-021), Mailpit, Caddy, Docker Compose.

## Требования

- Node.js 24+
- pnpm 12 (`corepack enable` или `npm i -g pnpm`)
- Docker Desktop (запущен) или Docker Engine с Compose — только для локальной инфраструктуры; при работе через VPS-туннель не требуется

## Быстрый старт

> В текущем окружении Postgres для разработки работает на VPS и доступен через SSH-туннель (ADR-027, `docs/ops.md` §2.1), поэтому `pnpm infra:up` не нужен. Локальный compose ниже — вариант для чистой машины.

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
pnpm install
pnpm infra:up               # Postgres, Silo (S3), Mailpit (нужен локальный Docker)
pnpm db:reset               # ВНИМАНИЕ: удаляет схему и данные в DATABASE_URL
pnpm seed:demo              # 14 домов, фото, брони и два демо-аккаунта
pnpm dev                    # API :3100 и web :5173
```

> `pnpm db:reset` разрушительный: он пересоздаёт схему в базе из `DATABASE_URL`
> и удаляет данные. На уже настроенной базе используйте `pnpm db:migrate`.

Демо-аккаунты после `pnpm seed:demo`:

| Роль | Email | Пароль |
|---|---|---|
| Хозяин | `host@staynest.demo` | `StayNest-Demo-2026` |
| Гость | `guest@staynest.demo` | `StayNest-Demo-2026` |

На живом стенде включено подтверждение email: после регистрации письмо уходит в
Mailpit, а вход до подтверждения возвращает `403 email_not_verified`. Письма
смотрятся через SSH-туннель к серверу:

```bash
ssh -N -L 8025:127.0.0.1:8025 staynest
# http://localhost:8025
```

Для быстрого тестирования используйте демо-аккаунты выше — их email уже
подтверждён. Пароль вида `admin`/`admin` не подойдёт: минимум 10 символов и
проверка по списку распространённых паролей.

Фото демо-домов взяты с StockSnap.io под CC0 1.0, источники перечислены в
`docs/credits.md`. Сид идемпотентен: повторный запуск заменяет только
демо-аккаунты (`host@staynest.demo`, `guest@staynest.demo`) и их данные.

Проверка:

- Web: http://localhost:5173
- API: http://localhost:3100/api/v1/health
- Mailpit: http://localhost:8025
- Консоль S3: http://localhost:9001

Порты выбраны так, чтобы не конфликтовать с другими локальными проектами (3000 и 5432 часто заняты). Подробности — ADR-022.

## Команды

| Команда | Что делает |
|---|---|
| `pnpm dev` | API и web в режиме разработки |
| `pnpm build` | Сборка API и web |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript без emit |
| `pnpm test` | Vitest во всех пакетах |
| `pnpm e2e` | Playwright e2e на dev-сервере (база готовится отдельно) |
| `pnpm e2e:pwa` | PWA e2e на production-сборке: SW, офлайн-чтение, очистка кэшей |
| `pnpm e2e:prepare` | Пересоздать `E2E_DATABASE_URL` (`_test`, loopback) и накатить миграции |
| `pnpm seed:demo` | Демо-данные: 14 домов, 13 броней, фото, два аккаунта |
| `pnpm seed:demo:clean` | Удалить демо-данные и их фото из S3 |
| `pnpm seed:perf` | 10 000 объявлений и 100 000 броней для замеров |
| `pnpm og:generate` | Пересобрать Open Graph-обложку из демо-фото |
| `pnpm depcheck` | Границы модулей (dependency-cruiser) |
| `pnpm knip` | Мёртвый код и неиспользуемые зависимости |
| `pnpm format` | Prettier |
| `pnpm infra:up` / `infra:down` | Инфраструктура для разработки |
| `pnpm peers check` | Проверка совместимости peer-зависимостей |

E2E не трогает базу без явной подготовки: `E2E_DATABASE_URL=postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test pnpm e2e:prepare`, затем `pnpm e2e` или `pnpm e2e:pwa`. Playwright сам поднимает API и web; для PWA-теста web собирается в production и запускается через `vite preview` на 4173.

## Структура

```
apps/api        Fastify API, модульный монолит
apps/web        React PWA
packages/shared общие zod-схемы и типы
infra           docker-compose для разработки и staging на VPS
docs            ТЗ, схема БД, дизайн, решения, план
scripts         серверные скрипты (аудит, бэкап, SSH)
```

Правила границ модулей и фронтенда — в `docs/ARCHITECTURE.md`. Ключевые архитектурные решения — в `docs/DECISIONS.md`. Сервер, очистка, бэкапы и деплой — в `docs/ops.md`.

## Безопасность

Секреты хранятся только в `.env` (в git не попадает) и на сервере. `.env.example` содержит лишь локальные значения по умолчанию. Подробности — `docs/SECURITY.md`.
