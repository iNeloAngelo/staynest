#!/usr/bin/env bash
# Ежедневный бэкап StayNest: Postgres (custom format) + бакет Silo.
# Запускается systemd-таймером staynest-backup.timer (см. infra/systemd/).
# Ручной запуск от пользователя deploy: ./scripts/prod-backup.sh
#
# Артефакты шифруются age публичным ключом; приватный ключ хранится только
# вне сервера (см. docs/ops.md §11). Без age и recipient-файла скрипт падает,
# чтобы не оставить на диске незашифрованные PII.
#
# Переменные (можно задать в /etc/staynest/backup.env):
#   BACKUP_DIR=/home/deploy/backups/staynest   каталог бэкапов (700)
#   KEEP_DAILY=7                       сколько дневных копий хранить
#   KEEP_WEEKLY=4                      сколько недельных копий хранить
#   AGE_BIN=/home/deploy/bin/age       бинарь age
#   AGE_RECIPIENT_FILE=$BACKUP_DIR/age-recipient.txt
#   BACKUP_REMOTE=                     необязательный rclone-путь для копии вне сервера
set -euo pipefail

REPO_DIR="/opt/staynest"
cd "$REPO_DIR"

# shellcheck disable=SC1091
[[ -f /etc/staynest/backup.env ]] && source /etc/staynest/backup.env

BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups/staynest}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
AGE_BIN="${AGE_BIN:-/home/deploy/bin/age}"
AGE_RECIPIENT_FILE="${AGE_RECIPIENT_FILE:-$BACKUP_DIR/age-recipient.txt}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAY_DIR="$BACKUP_DIR/daily"
WEEK_DIR="$BACKUP_DIR/weekly"

if [[ ! -f .env ]]; then
  echo "Нет $REPO_DIR/.env" >&2
  exit 1
fi
if [[ ! -x "$AGE_BIN" || ! -f "$AGE_RECIPIENT_FILE" ]]; then
  echo "Нет age ($AGE_BIN) или recipient-файла ($AGE_RECIPIENT_FILE): бэкап без шифрования запрещён" >&2
  exit 1
fi

PGUSER="$(grep -E '^POSTGRES_USER=' .env | cut -d= -f2-)"
PGDB="$(grep -E '^POSTGRES_DB=' .env | cut -d= -f2-)"
PG_CONTAINER="$(docker compose --env-file .env -f infra/docker-compose.prod.yml ps -q postgres)"
SILO_CONTAINER="$(docker compose --env-file .env -f infra/docker-compose.prod.yml ps -q silo)"

if [[ -z "$PG_CONTAINER" ]]; then
  echo "Контейнер postgres не запущен" >&2
  exit 1
fi

install -d -m 700 "$BACKUP_DIR" "$DAY_DIR" "$WEEK_DIR"
umask 077

# Не даём двум запускам пересечься (долгий restore-check).
exec 9>"$BACKUP_DIR/.lock"
if ! flock -n 9; then
  echo "Бэкап уже выполняется" >&2
  exit 0
fi

DUMP_NAME="staynest-$STAMP.dump"
GLOBALS_NAME="staynest-globals-$STAMP.sql"
DUMP_PATH="$DAY_DIR/$DUMP_NAME"
GLOBALS_PATH="$DAY_DIR/$GLOBALS_NAME"
PG_TMP="/tmp/$DUMP_NAME"
RESTORE_DB="${PGDB}_restore_check"

cleanup() {
  docker exec "$PG_CONTAINER" rm -f "$PG_TMP" >/dev/null 2>&1 || true
  if [[ -n "${RESTORE_CREATED:-}" ]]; then
    docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d postgres \
      -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\"" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

encrypt_file() {
  local file="$1"
  "$AGE_BIN" --encrypt --recipient "$(cat "$AGE_RECIPIENT_FILE")" --output "$file.age" "$file"
  chmod 600 "$file.age"
  rm -f "$file"
}

echo "[$(date -u +%FT%TZ)] dump $PGDB"
docker exec "$PG_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" --format=custom --compress=6 -f "$PG_TMP"
docker cp "$PG_CONTAINER:$PG_TMP" "$DUMP_PATH"
chmod 600 "$DUMP_PATH"

echo "[$(date -u +%FT%TZ)] globals (роли и настройки)"
docker exec "$PG_CONTAINER" pg_dumpall -U "$PGUSER" --globals-only > "$GLOBALS_PATH"
chmod 600 "$GLOBALS_PATH"

echo "[$(date -u +%FT%TZ)] verify dump"
docker cp "$DUMP_PATH" "$PG_CONTAINER:$PG_TMP"
docker exec "$PG_CONTAINER" pg_restore --list "$PG_TMP" > /dev/null

echo "[$(date -u +%FT%TZ)] restore into separate database"
docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\";" >/dev/null
docker exec "$PG_CONTAINER" createdb -U "$PGUSER" "$RESTORE_DB"
RESTORE_CREATED=1
docker exec "$PG_CONTAINER" pg_restore -U "$PGUSER" -d "$RESTORE_DB" --no-owner --exit-on-error "$PG_TMP"
RESTORED_USERS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$RESTORE_DB" -tAc 'SELECT count(*) FROM users')"
RESTORED_LISTINGS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$RESTORE_DB" -tAc 'SELECT count(*) FROM listings')"
RESTORED_BOOKINGS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$RESTORE_DB" -tAc 'SELECT count(*) FROM bookings')"
PROD_USERS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc 'SELECT count(*) FROM users')"
PROD_LISTINGS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc 'SELECT count(*) FROM listings')"
PROD_BOOKINGS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc 'SELECT count(*) FROM bookings')"
docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE \"$RESTORE_DB\";" >/dev/null
RESTORE_CREATED=""

if [[ "$RESTORED_USERS" != "$PROD_USERS" || "$RESTORED_LISTINGS" != "$PROD_LISTINGS" || "$RESTORED_BOOKINGS" != "$PROD_BOOKINGS" ]]; then
  echo "Restore-check не совпал: users $RESTORED_USERS/$PROD_USERS, listings $RESTORED_LISTINGS/$PROD_LISTINGS, bookings $RESTORED_BOOKINGS/$PROD_BOOKINGS" >&2
  exit 1
fi
printf 'users=%s listings=%s bookings=%s\n' "$RESTORED_USERS" "$RESTORED_LISTINGS" "$RESTORED_BOOKINGS" > "$DAY_DIR/$DUMP_NAME.restore-check.txt"
chmod 600 "$DAY_DIR/$DUMP_NAME.restore-check.txt"

echo "[$(date -u +%FT%TZ)] backup bucket"
SILO_ARCHIVE=""
if [[ -n "$SILO_CONTAINER" ]]; then
  SILO_VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$SILO_CONTAINER")"
  PG_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$PG_CONTAINER")"
  if [[ -n "$SILO_VOLUME" ]]; then
    SILO_ARCHIVE="$DAY_DIR/staynest-silo-$STAMP.tar.gz"
    docker run --rm \
      -v "$SILO_VOLUME:/data:ro" \
      -v "$DAY_DIR:/backup" \
      "$PG_IMAGE" sh -c "tar czf '/backup/staynest-silo-$STAMP.tar.gz' -C /data . && chown $(id -u):$(id -g) '/backup/staynest-silo-$STAMP.tar.gz' && chmod 600 '/backup/staynest-silo-$STAMP.tar.gz'"
  else
    echo "Не найден том /data контейнера silo, пропускаю бэкап бакета" >&2
  fi
else
  echo "Контейнер silo не запущен, пропускаю бэкап бакета" >&2
fi

echo "[$(date -u +%FT%TZ)] encrypt"
encrypt_file "$DUMP_PATH"
encrypt_file "$GLOBALS_PATH"
if [[ -n "$SILO_ARCHIVE" ]]; then
  encrypt_file "$SILO_ARCHIVE"
fi

echo "[$(date -u +%FT%TZ)] checksums"
sha256sum "$DUMP_PATH.age" > "$DUMP_PATH.age.sha256"
chmod 600 "$DUMP_PATH.age.sha256"
if [[ -n "$SILO_ARCHIVE" ]]; then
  sha256sum "$SILO_ARCHIVE.age" > "$SILO_ARCHIVE.age.sha256"
  chmod 600 "$SILO_ARCHIVE.age.sha256"
fi

# Недельная копия по воскресеньям (UTC).
if [[ "$(date -u +%u)" == "7" ]]; then
  cp -p "$DAY_DIR"/*"$STAMP"* "$WEEK_DIR/"
fi

echo "[$(date -u +%FT%TZ)] retention"
find "$DAY_DIR" -type f -mtime +"$((KEEP_DAILY - 1))" ! -name '.*' -delete
find "$WEEK_DIR" -type f -mtime +"$((KEEP_WEEKLY * 7 - 1))" -delete

if [[ -n "$BACKUP_REMOTE" ]]; then
  if command -v rclone >/dev/null 2>&1; then
    echo "[$(date -u +%FT%TZ)] offsite copy → $BACKUP_REMOTE"
    rclone copy "$DAY_DIR" "$BACKUP_REMOTE/daily" --include "*$STAMP*" --no-traverse
  else
    echo "BACKUP_REMOTE задан, но rclone не установлен" >&2
    exit 1
  fi
else
  echo "BACKUP_REMOTE не задан: копию вне сервера нужно забрать вручную (scripts/pull-backups.ps1)" >&2
fi

echo "[$(date -u +%FT%TZ)] done: $DUMP_PATH.age"
ls -lh "$DUMP_PATH.age" "$SILO_ARCHIVE.age" 2>/dev/null || true
