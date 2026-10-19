# platform/db

Подключение к PostgreSQL и типы схемы.

- `createDb(connectionString, logger, queryTimeoutMs)` — пул `pg` с таймаутами, Kysely поверх того же пула, health-check и корректное закрытие.
- `db.kysely` — типобезопасные запросы (`Kysely<DB>`).
- `db.pool` — сырые запросы и транзакции, где нужен `FOR UPDATE` или SQL, который неудобно выражать через Kysely.
- `schema.generated.ts` — типы, сгенерированные из живой БД. Править вручную нельзя.

## Как обновить типы после миграции

```bash
pnpm db:migrate   # или pnpm db:reset
pnpm db:codegen
```

`db:codegen` читает `DATABASE_URL` из `.env` и запускает `kysely-codegen`. Служебная таблица `pgmigrations` исключена.

## Тесты

Интеграционные тесты схемы лежат в `apps/api/tests/db`. Они используют `DATABASE_URL_TEST`, пересоздают схему и накатывают миграции перед прогоном. Без этой переменной блок пропускается.
