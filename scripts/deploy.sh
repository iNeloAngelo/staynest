#!/usr/bin/env bash
# Деплой на VPS. Запускать из корня репозитория на сервере:
#   ./scripts/deploy.sh                    # выкатить origin/main
#   DEPLOY_REF=v1.2.3 ./scripts/deploy.sh  # выкатить тег/ветку/коммит (CI/CD)
#   SKIP_PRE_DEPLOY_BACKUP=1 ./scripts/deploy.sh  # только для отладки
# Требования: git-доступ, .env (600) рядом с compose, пользователь в группе docker.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose --env-file .env -f infra/docker-compose.prod.yml)
DEPLOY_REF="${DEPLOY_REF:-}"
PREVIOUS_SHA="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

if [[ ! -f .env ]]; then
  echo "Нет .env: скопируйте .env.example и заполните секреты." >&2
  exit 1
fi
if [[ "$(stat -c %a .env)" != "600" ]]; then
  echo ".env должен иметь права 600 (сейчас $(stat -c %a .env))" >&2
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

resolve_ref() {
  local ref="$1" candidate
  for candidate in "origin/$ref" "refs/tags/$ref" "$ref"; do
    if git rev-parse --verify --quiet "${candidate}^{commit}" >/dev/null; then
      git rev-parse "${candidate}^{commit}"
      return 0
    fi
  done
  return 1
}

echo "== fetch =="
git fetch --prune --tags --force origin
TARGET_REF="${DEPLOY_REF:-main}"
if ! TARGET_SHA="$(resolve_ref "$TARGET_REF")"; then
  echo "Неизвестная ссылка: $TARGET_REF" >&2
  exit 1
fi

echo "== checkout $TARGET_REF ($TARGET_SHA) =="
git checkout --force --detach "$TARGET_SHA"
DEPLOYED_SHA="$(git rev-parse --short HEAD)"
echo "deployed: $DEPLOYED_SHA (previous: $PREVIOUS_SHA)"

if [[ "${SKIP_PRE_DEPLOY_BACKUP:-0}" != "1" ]]; then
  echo "== pre-deploy backup =="
  PGUSER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
  PGDB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"
  PG_ID="$("${COMPOSE[@]}" ps -q postgres)"
  status=$(docker inspect --format '{{.State.Health.Status}}' "$PG_ID" 2>/dev/null || echo missing)
  if [[ "$status" != "healthy" ]]; then
    echo "Postgres не healthy ($status): поднимаю Postgres и Silo перед бэкапом"
    "${COMPOSE[@]}" down --remove-orphans || true
    "${COMPOSE[@]}" up -d postgres silo
    for _ in $(seq 1 40); do
      PG_ID="$("${COMPOSE[@]}" ps -q postgres)"
      status=$(docker inspect --format '{{.State.Health.Status}}' "$PG_ID" 2>/dev/null || echo starting)
      if [[ "$status" == "healthy" ]]; then break; fi
      sleep 2
    done
    if [[ "$status" != "healthy" ]]; then
      echo "Postgres не стал healthy перед бэкапом" >&2
      exit 1
    fi
  fi
  HAS_USERS="$(docker exec "$PG_ID" psql -U "$PGUSER" -d "$PGDB" -tAc "SELECT to_regclass('public.users') IS NOT NULL" 2>/dev/null || echo f)"
  if [[ "$HAS_USERS" != "t" ]]; then
    echo "Схема ещё не создана: pre-deploy бэкап пропущен (первый деплой/чистая БД)"
  else
    export REPO_DIR="$PWD"
    if ! ./scripts/prod-backup.sh; then
      echo "Бэкап перед деплоем не удался — выкатка остановлена." >&2
      exit 1
    fi
  fi
fi

echo "== build =="
"${COMPOSE[@]}" build

echo "== stop stack (network changes need clean recreate) =="
"${COMPOSE[@]}" down --remove-orphans

echo "== postgres =="
"${COMPOSE[@]}" up -d postgres
PG_ID="$("${COMPOSE[@]}" ps -q postgres)"
for _ in $(seq 1 40); do
  status=$(docker inspect --format '{{.State.Health.Status}}' "$PG_ID" 2>/dev/null || echo starting)
  if [[ "$status" == "healthy" ]]; then break; fi
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
docker image prune -f --filter until=168h >/dev/null

echo "== status =="
"${COMPOSE[@]}" ps

DOMAIN="$(grep -E '^DOMAIN=' .env | cut -d= -f2- | tr -d '"')"
if [[ -n "$DOMAIN" ]]; then
  echo "== health =="
  for _ in $(seq 1 30); do
    if curl -fsS --max-time 5 "https://$DOMAIN/api/v1/health" | grep -q '"db":"up"'; then
      echo "health: ok"
      exit 0
    fi
    sleep 2
  done
  echo "health: не отвечает. Выкачен $DEPLOYED_SHA, до деплоя был $PREVIOUS_SHA." >&2
  echo "Смотрите: docker compose --env-file .env -f infra/docker-compose.prod.yml logs api caddy" >&2
  echo "Миграции в этом проекте только вперёд: откат кода без восстановления БД неполный (docs/ops.md §7/§11)." >&2
  echo "Код можно вернуть: DEPLOY_REF=$PREVIOUS_SHA ./scripts/deploy.sh" >&2
  exit 1
fi
