# Модуль health

## Зачем

Служебная проверка доступности API и базы. Используется мониторингом, Docker healthcheck
и деплой-скриптом.

## Публичный API

- `GET /api/v1/health` — `200 { status: "ok", db: "up", version, uptime }`, если база доступна;
  `503 { status: "degraded", db: "down" }`, если нет.

## Таблицы

Нет. Проверка делает `select 1` через `platform/db`.

## События

Нет.

## Как тестировать

```bash
pnpm --filter @staynest/api test
curl -i http://localhost:3000/api/v1/health
```

Тесты используют `app.inject()` и подменяют `db.check`, поэтому база для юнит-тестов не нужна.
