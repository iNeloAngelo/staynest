# StayNest

PWA для аренды домов: хозяин создаёт объявление и управляет календарём, гость
ищет свободные даты и отправляет заявку на бронирование. Один аккаунт, два
режима — «Я ищу» и «Я сдаю».

**Живой стенд:** https://olivertwist95.clodocd.com · **Код:** https://github.com/iNeloAngelo/staynest · **Разбор кейса:** [docs/case-study.md](docs/case-study.md)

[![Тур по StayNest](docs/media/tour.gif)](https://olivertwist95.clodocd.com)

## Что это

Портфолио-кейс, собранный по сессиям: план, правила и Definition of Done лежат
в [docs/SESSIONS.md](docs/SESSIONS.md) и [AGENTS.md](AGENTS.md). Главная
инженерная идея — **двойное бронирование невозможно на уровне PostgreSQL**, а
не только в коде приложения.

| Гость | Хозяин |
|---|---|
| Каталог с фильтрами и поиском по свободным датам | Мастер создания объявления (5 шагов, автосохранение) |
| Календарь с занятыми ночами и ценой за период | Цены: выходные и сезонные правила |
| Заявка с сообщением, «Мои поездки», отмена | «Входящие заявки»: подтвердить/отклонить |
| Избранное, уведомления, Web Push | Календарь занятости, сводка и доход |
| PWA: установка, офлайн-чтение, тёмная тема | Депозит после подтверждения (мок-оплата) |

Скриншоты: [docs/screens](docs/screens) (360 / 768 / 1280, светлая и тёмная
тема).

## Архитектура

```mermaid
flowchart LR
  subgraph Client["Браузер / PWA"]
    SPA["React SPA<br/>TanStack Query · Workbox"]
  end
  subgraph Edge["Caddy (HTTPS)"]
    direction TB
    STATIC["Статика и /media"]
    PROXY["/api/v1 → API<br/>SSE без буферизации"]
  end
  subgraph Server["Docker Compose на VPS"]
    API["Fastify API<br/>15 модулей"]
    WORKER["Worker<br/>pg-boss: истечение,<br/>завершение, депозиты"]
  end
  PG[("PostgreSQL 16<br/>btree_gist · citext · pg_trgm")]
  S3[("Silo (S3)<br/>фото и аватары")]
  MAIL["Mailpit / SMTP"]

  SPA --> STATIC
  SPA --> PROXY --> API
  SPA -. "SSE /me/events" .-> API
  API --> PG
  WORKER --> PG
  API --> S3
  API --> MAIL
  WORKER -. "push через web-push" .-> SPA
```

- **Модульный монолит.** 15 модулей API (`apps/api/src/modules`) и 14 фич web
  (`apps/web/src/features`). Границы проверяет dependency-cruiser: импорт
  внутренностей чужого модуля ломает CI. Карта блоков —
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), полный граф —
  [docs/architecture/deps.svg](docs/architecture/deps.svg).
- **Один аккаунт, два режима.** Роль определяется действием, а не типом
  аккаунта; права проверяются на сервере на каждом эндпоинте.
- **Фоновые задачи** (истечение заявки, завершение брони, просрочка депозита)
  живут в отдельном процессе worker, чтобы API не блокировался.

### Схема данных

Полная ER-схема и описание таблиц — [docs/DB.md](docs/DB.md). Ядро:

```mermaid
erDiagram
  users ||--o{ listings : "owner_id"
  users ||--o{ bookings : "guest_id"
  listings ||--o{ bookings : has
  bookings ||--o{ booking_events : logs
  bookings ||--o{ payments : "депозит"
  listings ||--o{ listing_photos : has
  listings ||--o{ listing_price_rules : has
  listings ||--o{ listing_blocks : has
  users ||--o{ favorites : has
  users ||--o{ notifications : receives
  users ||--o{ push_subscriptions : has
```

### Статусы брони

```mermaid
stateDiagram-v2
  [*] --> pending: гость отправил заявку
  pending --> confirmed: хозяин подтвердил
  pending --> declined: хозяин отклонил
  pending --> expired: истёк TTL (24 ч)
  pending --> cancelled_by_guest: гость отменил
  confirmed --> cancelled_by_guest: до заезда
  confirmed --> cancelled_by_host: хозяин с причиной
  confirmed --> completed: прошла дата выезда
  confirmed --> expired: депозит не оплачен в срок
  declined --> [*]
  expired --> [*]
  completed --> [*]
  cancelled_by_guest --> [*]
  cancelled_by_host --> [*]
```

Движок, порядок блокировок, идемпотентность и коды ошибок —
[docs/booking-engine.md](docs/booking-engine.md).

## Технологии

- **Монорепо:** pnpm workspaces, Node.js 24, TypeScript strict.
- **API:** Fastify, zod, Kysely + pg, node-pg-migrate, pg-boss, argon2, sharp,
  S3 SDK, web-push, pino.
- **Web:** React 19, Vite, React Router, TanStack Query, Tailwind CSS,
  react-hook-form + zod, react-day-picker, i18next (ru/en), vite-plugin-pwa.
- **Инфраструктура:** PostgreSQL 16, Silo (S3, форк MinIO — ADR-021), Mailpit,
  Caddy, Docker Compose на VPS.

Решения и их причины — 101 ADR в [docs/DECISIONS.md](docs/DECISIONS.md).

## Быстрый старт

Требования: Node.js 24+, pnpm 12, Docker (для локальной инфраструктуры).

```bash
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
pnpm install
pnpm infra:up               # Postgres, Silo (S3), Mailpit
pnpm db:reset               # ВНИМАНИЕ: пересоздаёт схему в DATABASE_URL
pnpm seed:demo              # 14 домов, фото, брони, два демо-аккаунта
pnpm dev                    # API :3100 и web :5173
```

> `pnpm db:reset` разрушительный: он пересоздаёт схему в базе из `DATABASE_URL`.
> На настроенной базе используйте `pnpm db:migrate`.

В текущем окружении Postgres для разработки работает на VPS и доступен через
SSH-туннель ([docs/ops.md](docs/ops.md), §2.1), поэтому `pnpm infra:up` можно
пропустить.

- Web: http://localhost:5173
- API: http://localhost:3100/api/v1/health
- Mailpit: http://localhost:8025
- Консоль S3: http://localhost:9001

Порты выбраны так, чтобы не конфликтовать с другими проектами (ADR-022).

## Демо-аккаунты

| Роль | Email | Пароль |
|---|---|---|
| Хозяин | `host@staynest.demo` | `StayNest-Demo-2026` |
| Гость | `guest@staynest.demo` | `StayNest-Demo-2026` |

На стенде включено подтверждение email: у демо-аккаунтов оно уже пройдено, а
новые письма уходят в Mailpit (доступ по SSH-туннелю, `docs/ops.md`).
Сид идемпотентен: повторный `pnpm seed:demo` заменяет только демо-аккаунты и
их данные. Фото — StockSnap.io под CC0, источники в
[docs/credits.md](docs/credits.md).

> **Стенд демонстрационный.** Не вводите настоящие персональные данные и
> реальные платёжные реквизиты: база пересоздаётся, письма уходят в тестовый
> Mailpit, оплата — мок. Демо-аккаунты общие, поэтому не храните в них ничего
> личного.

## Проверки и отчёты

| Команда | Что делает |
|---|---|
| `pnpm lint` | ESLint: TypeScript strict-правила, React, jsx-a11y, лимиты размера |
| `pnpm typecheck` | TypeScript strict без emit |
| `pnpm test` | Vitest: 605 тестов в API, web и shared |
| `pnpm e2e` | Playwright: бронирование от публикации до подтверждения |
| `pnpm e2e:pwa` | PWA на production-сборке: SW, офлайн, очистка кэшей |
| `pnpm depcheck` | dependency-cruiser: циклы и границы модулей |
| `pnpm knip` | мёртвый код и неиспользуемые зависимости |
| `pnpm build` | Сборка API и web |
| `pnpm db:reset` / `db:migrate` | Пересоздать / докатить миграции |
| `pnpm seed:demo` / `seed:perf` | Демо-данные / 10 000 домов и 100 000 броней |
| `pnpm perf:search` / `perf:http` | EXPLAIN + p50/p95 SQL и HTTP |

Отчёты: [конкурентность](docs/perf/concurrency.md) ·
[планы запросов](docs/perf/search.md) ·
[Lighthouse](docs/perf/lighthouse.md) ·
[покрытие тестами](docs/perf/coverage.md) ·
[безопасность (ZAP + OWASP)](docs/security-report.md).

E2E не трогает базу без подготовки:

```bash
E2E_DATABASE_URL=postgres://staynest:staynest@127.0.0.1:5433/staynest_e2e_test pnpm e2e:prepare
pnpm e2e        # или pnpm e2e:pwa
```

Playwright сам поднимает API и web; для PWA-теста web собирается в production и
запускается через `vite preview` на 4173.

## Структура

```
apps/api          Fastify API, модульный монолит
apps/web          React PWA
packages/shared   общие zod-схемы и типы
db/migrations     миграции node-pg-migrate (11, каждая с up и down)
e2e, e2e-pwa      Playwright: сценарий брони и PWA-офлайн
infra             docker-compose для разработки и прода, Caddyfile
docs              ТЗ, схема БД, дизайн, ADR, отчёты, скриншоты
scripts           сиды, замеры, бэкапы, деплой, демо-тур
```

## Документация

| Документ | О чём |
|---|---|
| [docs/case-study.md](docs/case-study.md) | Кейс: задача, решения, сложности, результаты |
| [docs/TZ.md](docs/TZ.md) | Техническое задание и критерии готовности |
| [docs/DB.md](docs/DB.md) | Схема БД, миграции, ключевые запросы |
| [docs/DESIGN.md](docs/DESIGN.md) | Дизайн-токены, компоненты, состояния |
| [docs/DECISIONS.md](docs/DECISIONS.md) | ADR: что выбрано и почему |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Границы модулей и правила зависимостей |
| [docs/booking-engine.md](docs/booking-engine.md) | Бронирование, идемпотентность, джобы |
| [docs/SECURITY.md](docs/SECURITY.md) | Модель угроз и защита |
| [docs/security-report.md](docs/security-report.md) | ZAP baseline и чек-лист OWASP Top 10 |
| [docs/ops.md](docs/ops.md) | Сервер, деплой, бэкапы, восстановление |
| [docs/payments.md](docs/payments.md) | Мок-платёж и замена на провайдера |
| [docs/telegram.md](docs/telegram.md) | Telegram Mini App |
| [docs/demo.md](docs/demo.md) | Сценарий демо, видео и установка PWA |
| [docs/pitch.md](docs/pitch.md) | Тексты для резюме и профилей |
| [docs/LEARNS.md](docs/LEARNS.md) | Журнал граблей и решений |
| [docs/TODO.md](docs/TODO.md) | Чек-лист сессий и Backlog |

## Установка на телефон

Android: открыть стенд в Chrome → баннер «Установить приложение» (или меню ⋮ →
«Установить приложение»). iPhone: только Safari → «Поделиться» → «На экран
«Домой»». Подробная инструкция и проверка офлайна/пуша —
[docs/demo.md](docs/demo.md), §4.

## Безопасность

Секреты хранятся только в `.env` (в git не попадает) и на сервере;
`.env.example` содержит лишь локальные значения. Пароли — argon2id, сессии —
httpOnly cookie с ротацией refresh, права проверяются на сервере, IDOR
закрыт матрицей тестов. История git проверена `gitleaks`, зависимости —
`pnpm audit` в CI. Подробности — [docs/SECURITY.md](docs/SECURITY.md) и
[docs/security-report.md](docs/security-report.md).

## Ограничения

Проект осознанно не делает всё: SSE-хаб живёт в памяти одного инстанса, Web
Push на реальных iPhone/Android требует ручной проверки, платёж — мок, отзывы
не реализованы. Полный список — [docs/TODO.md](docs/TODO.md), раздел Backlog,
и раздел 8 в [docs/case-study.md](docs/case-study.md).
