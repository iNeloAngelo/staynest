#!/usr/bin/env bash
# Деплой на VPS. Запускать из корня репозитория на сервере:
#   ./scripts/deploy.sh                 # обновить текущую ветку (git pull --ff-only)
#   DEPLOY_REF=v1.2.3 ./scripts/deploy.sh  # перейти на тег/коммит (CI/CD)
# Требования: git-доступ к репозиторию, .env рядом с compose, пользователь в группе docker.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose --env-file .env -f infra/docker-compose.prod.yml)
DEPLOY_REF="${DEPLOY_REF:-}"

if [[ ! -f .env ]]; then
  echo "Нет .env: скопируйте .env.example и заполните секреты." >&2
  exit 1
fi

if grep -qE '^JWT_SECRET=$|^JWT_SECRET=dev-only-' .env; then
  echo "Задайте случайный JWT_SECRET в .env: openssl rand -base64 48" >&2
  exit 1
fi

if grep -qE '^(CORS_ORIGINS|APP_WEB_URL)=.*(localhost|127\.0\.0\.1)' .env; then
  echo "CORS_ORIGINS и APP_WEB_URL в production не должны содержать localhost." >&2
  exit 1
fi

if [[ -n "$DEPLOY_REF" ]]; then
  echo "== checkout $DEPLOY_REF =="
  git fetch --tags --force origin
  git checkout --force "$DEPLOY_REF"
else
  echo "== git pull =="
  git pull --ff-only
fi

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

DOMAIN=$(grep -E '^DOMAIN=' .env | cut -d= -f2- | tr -d '"')
if [[ -n "$DOMAIN" ]]; then
  echo "== health =="
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "https://$DOMAIN/api/v1/health" | grep -q '"db":"up"'; then
      echo "health: ok"
      exit 0
    fi
    sleep 2
  done
  echo "health: не отвечает, смотрите docker compose logs api caddy" >&2
  exit 1
fi
