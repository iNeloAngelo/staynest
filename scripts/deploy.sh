#!/usr/bin/env bash
# Деплой текущей ветки на VPS. Запускать из корня репозитория на сервере:
#   ./scripts/deploy.sh
# Требования: git-доступ к репозиторию, .env рядом с compose, пользователь в группе docker.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose --env-file .env -f infra/docker-compose.prod.yml)

if [[ ! -f .env ]]; then
  echo "Нет .env: скопируйте .env.example и заполните секреты." >&2
  exit 1
fi

if grep -qE '^JWT_SECRET=(|dev-only-)' .env; then
  echo "Задайте случайный JWT_SECRET в .env: openssl rand -base64 48" >&2
  exit 1
fi

if grep -qE '^(CORS_ORIGINS|APP_WEB_URL)=.*(localhost|127\.0\.0\.1)' .env; then
  echo "CORS_ORIGINS и APP_WEB_URL в production не должны содержать localhost." >&2
  exit 1
fi

echo "== git pull =="
git pull --ff-only

echo "== build =="
"${COMPOSE[@]}" build

echo "== postgres =="
"${COMPOSE[@]}" up -d postgres
for _ in $(seq 1 40); do
  status=$(docker inspect --format '{{.State.Health.Status}}' staynest-postgres-1 2>/dev/null || echo starting)
  [[ "$status" == "healthy" ]] && break
  sleep 2
done
if [[ "$status" != "healthy" ]]; then
  echo "Postgres не стал healthy" >&2
  exit 1
fi

echo "== migrations =="
"${COMPOSE[@]}" run --rm --no-deps api node dist/migrate.js

echo "== up =="
"${COMPOSE[@]}" up -d
docker image prune -f >/dev/null

echo "== status =="
"${COMPOSE[@]}" ps
