#!/usr/bin/env bash
# Ежедневный бэкап StayNest: Postgres (custom format) + бакет Silo.
# Запускается systemd-таймером staynest-backup.timer (см. infra/systemd/).
# Ручной запуск: sudo /opt/staynest/scripts/prod-backup.sh
#
# Переменные (можно задать в /etc/staynest/backup.env):
#   BACKUP_DIR=/home/deploy/backups/staynest   каталог бэкапов (700)
#   KEEP_DAILY=7                       сколько дневных копий хранить
#   KEEP_WEEKLY=4                      сколько недельных копий хранить
#   BACKUP_REMOTE=                     необязательный rclone-путь для копии вне сервера
#                                      (например, "remote:staynest-backups")
set -euo pipefail

REPO_DIR="/opt/staynest"
cd "$REPO_DIR"

# shellcheck disable=SC1091
[[ -f /etc/staynest/backup.env ]] && source /etc/staynest/backup.env

BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups/staynest}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DAY_DIR="$BACKUP_DIR/daily"
WEEK_DIR="$BACKUP_DIR/weekly"

if [[ ! -f .env ]]; then
  echo "Нет $REPO_DIR/.env" >&2
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
PG_TMP="/tmp/$DUMP_NAME"

cleanup() {
  docker exec "$PG_CONTAINER" rm -f "$PG_TMP" "$GLOBALS_NAME" >/dev/null 2>&1 || true
  rm -f "$DAY_DIR/.partial-$STAMP" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "[$(date -u +%FT%TZ)] dump $PGDB"
docker exec "$PG_CONTAINER" pg_dump -U "$PGUSER" -d "$PGDB" --format=custom --compress=6 -f "$PG_TMP"
docker cp "$PG_CONTAINER:$PG_TMP" "$DUMP_PATH"
chmod 600 "$DUMP_PATH"

echo "[$(date -u +%FT%TZ)] globals (роли и настройки)"
docker exec "$PG_CONTAINER" pg_dumpall -U "$PGUSER" --globals-only > "$DAY_DIR/$GLOBALS_NAME"
chmod 600 "$DAY_DIR/$GLOBALS_NAME"

echo "[$(date -u +%FT%TZ)] verify dump"
docker cp "$DUMP_PATH" "$PG_CONTAINER:$PG_TMP"
docker exec "$PG_CONTAINER" pg_restore --list "$PG_TMP" > /dev/null

echo "[$(date -u +%FT%TZ)] restore into separate database"
RESTORE_DB="${PGDB}_restore_check"
docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$RESTORE_DB\";" >/dev/null
docker exec "$PG_CONTAINER" createdb -U "$PGUSER" "$RESTORE_DB"
docker exec "$PG_CONTAINER" pg_restore -U "$PGUSER" -d "$RESTORE_DB" --no-owner --exit-on-error "$PG_TMP"
RESTORED_USERS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$RESTORE_DB" -tAc 'SELECT count(*) FROM users')"
RESTORED_LISTINGS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$RESTORE_DB" -tAc 'SELECT count(*) FROM listings')"
RESTORED_BOOKINGS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$RESTORE_DB" -tAc 'SELECT count(*) FROM bookings')"
PROD_USERS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc 'SELECT count(*) FROM users')"
PROD_LISTINGS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc 'SELECT count(*) FROM listings')"
PROD_BOOKINGS="$(docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d "$PGDB" -tAc 'SELECT count(*) FROM bookings')"
docker exec "$PG_CONTAINER" psql -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE \"$RESTORE_DB\";" >/dev/null

if [[ "$RESTORED_USERS" != "$PROD_USERS" || "$RESTORED_LISTINGS" != "$PROD_LISTINGS" || "$RESTORED_BOOKINGS" != "$PROD_BOOKINGS" ]]; then
  echo "Restore-check не совпал: users $RESTORED_USERS/$PROD_USERS, listings $RESTORED_LISTINGS/$PROD_LISTINGS, bookings $RESTORED_BOOKINGS/$PROD_BOOKINGS" >&2
  exit 1
fi
printf 'users=%s listings=%s bookings=%s\n' "$RESTORED_USERS" "$RESTORED_LISTINGS" "$RESTORED_BOOKINGS" > "$DAY_DIR/$DUMP_NAME.restore-check.txt"

echo "[$(date -u +%FT%TZ)] backup bucket"
if [[ -n "$SILO_CONTAINER" ]]; then
  SILO_VOLUME="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/data"}}{{.Name}}{{end}}{{end}}' "$SILO_CONTAINER")"
  PG_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$PG_CONTAINER")"
  if [[ -n "$SILO_VOLUME" ]]; then
    docker run --rm \
      -v "$SILO_VOLUME:/data:ro" \
      -v "$DAY_DIR:/backup" \
      "$PG_IMAGE" sh -c "tar czf '/backup/staynest-silo-$STAMP.tar.gz' -C /data . && chown $(id -u):$(id -g) '/backup/staynest-silo-$STAMP.tar.gz' && chmod 600 '/backup/staynest-silo-$STAMP.tar.gz'"
    sha256sum "$DAY_DIR/staynest-silo-$STAMP.tar.gz" > "$DAY_DIR/staynest-silo-$STAMP.tar.gz.sha256"
    chmod 600 "$DAY_DIR/staynest-silo-$STAMP.tar.gz.sha256"
  else
    echo "Не найден том /data контейнера silo, пропускаю бэкап бакета" >&2
  fi
else
  echo "Контейнер silo не запущен, пропускаю бэкап бакета" >&2
fi

echo "[$(date -u +%FT%TZ)] checksums"
sha256sum "$DUMP_PATH" > "$DUMP_PATH.sha256"
chmod 600 "$DUMP_PATH.sha256"

# Недельная копия по воскресеньям (UTC).
if [[ "$(date -u +%u)" == "7" ]]; then
  cp -p "$DUMP_PATH" "$WEEK_DIR/"
  cp -p "$DUMP_PATH.sha256" "$WEEK_DIR/"
  cp -p "$DAY_DIR/$GLOBALS_NAME" "$WEEK_DIR/"
  [[ -f "$DAY_DIR/staynest-silo-$STAMP.tar.gz" ]] && cp -p "$DAY_DIR/staynest-silo-$STAMP.tar.gz" "$WEEK_DIR/"
fi

echo "[$(date -u +%FT%TZ)] retention"
find "$DAY_DIR" -type f -mtime +"$KEEP_DAILY" ! -name '.*' -delete
find "$WEEK_DIR" -type f -mtime +"$((KEEP_WEEKLY * 7))" -delete

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

echo "[$(date -u +%FT%TZ)] done: $DUMP_PATH"
ls -lh "$DUMP_PATH" "$DAY_DIR/staynest-silo-$STAMP.tar.gz" 2>/dev/null || true
