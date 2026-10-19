#!/usr/bin/env bash
# StayNest: полный логический бэкап сервера и n8n.
# Ничего не удаляет и не останавливает. Только читает и складывает архив.
#
# Usage:
#   bash scripts/server-backup.sh
#
# Результат:
#   /root/backups/server-YYYYmmdd-HHMMSS/         (рабочая папка)
#   /root/backups/server-YYYYmmdd-HHMMSS.tar.gz   (архив, 600)
#   /root/backups/server-YYYYmmdd-HHMMSS.tar.gz.sha256
#
# В архиве есть секреты (.env, ключи, дамп БД). Хранить только у себя, в git не коммитить.

set -euo pipefail
umask 077
export LC_ALL=C

TS=$(date +%Y%m%d-%H%M%S)
BASE=/root/backups
WORK="$BASE/server-$TS"
ARCHIVE="$BASE/server-$TS.tar.gz"

mkdir -p "$WORK/meta" "$WORK/config" "$WORK/n8n"
chmod 700 "$BASE" "$WORK"
exec > >(tee -a "$WORK/backup.log") 2>&1

log() { printf '\n== %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*"; }

log "Backup $TS started"
date -Is
hostname

# ---------------------------------------------------------------- meta
log "System and packages"
{
  date -Is
  hostname
  uname -a
  cat /etc/os-release
  echo
  printf 'CPU: '; nproc
  free -h
  df -hT
  lsblk
  ip a
  ip r
  ss -tulpn
  timedatectl
  locale
} > "$WORK/meta/system.txt" 2>&1 || warn "system meta partially failed"

{
  getent passwd
  echo
  getent group
} > "$WORK/meta/users-groups.txt" 2>&1 || true

dpkg --get-selections > "$WORK/meta/dpkg-selections.txt" 2>&1 || true
apt-mark showmanual > "$WORK/meta/apt-manual.txt" 2>&1 || true
apt list --upgradable > "$WORK/meta/apt-upgradable.txt" 2>&1 || true
snap list > "$WORK/meta/snap.txt" 2>&1 || true

log "Services, timers, cron"
systemctl list-unit-files --no-pager > "$WORK/meta/units-files.txt" 2>&1 || true
systemctl list-units --all --no-pager > "$WORK/meta/units.txt" 2>&1 || true
systemctl --failed --no-pager > "$WORK/meta/units-failed.txt" 2>&1 || true
systemctl list-timers --all --no-pager > "$WORK/meta/timers.txt" 2>&1 || true
crontab -l > "$WORK/meta/crontab-root.txt" 2>&1 || true
atq > "$WORK/meta/atq.txt" 2>&1 || true
ls -la /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.weekly /etc/cron.monthly \
  > "$WORK/meta/cron-dirs.txt" 2>&1 || true

log "Firewall"
iptables-save > "$WORK/meta/iptables.rules" 2>&1 || true
ip6tables-save > "$WORK/meta/ip6tables.rules" 2>&1 || true
ufw status verbose > "$WORK/meta/ufw.txt" 2>&1 || true

log "Docker metadata"
docker version > "$WORK/meta/docker-version.txt" 2>&1 || true
docker info > "$WORK/meta/docker-info.txt" 2>&1 || true
docker ps -a --no-trunc > "$WORK/meta/docker-ps.txt" 2>&1 || true
docker images --digests --no-trunc > "$WORK/meta/docker-images.txt" 2>&1 || true
docker volume ls > "$WORK/meta/docker-volumes.txt" 2>&1 || true
docker network ls > "$WORK/meta/docker-networks.txt" 2>&1 || true
docker system df -v > "$WORK/meta/docker-df.txt" 2>&1 || true
docker compose ls -a > "$WORK/meta/docker-compose-projects.txt" 2>&1 || true

# ---------------------------------------------------------------- config
log "Archiving /etc and /root"
tar czf "$WORK/config/etc-and-root.tar.gz" -C / \
  --exclude='root/backups' \
  --exclude='root/.cache' \
  etc root 2>"$WORK/config/tar-etc.err" || warn "tar /etc or /root had warnings (see tar-etc.err)"

log "Archiving /usr/local, /var/www, /home, /srv"
tar czf "$WORK/config/usr-local-www.tar.gz" -C / \
  usr/local var/www home srv 2>"$WORK/config/tar-usr-local.err" || warn "tar /usr/local or /var/www had warnings"

# ---------------------------------------------------------------- n8n
log "n8n metadata"
docker exec n8n-n8n-1 n8n --version > "$WORK/n8n/version.txt" 2>&1 || warn "n8n version failed"
docker exec n8n-postgres-1 postgres --version > "$WORK/n8n/postgres-version.txt" 2>&1 || warn "postgres version failed"
docker inspect n8n-n8n-1 n8n-postgres-1 > "$WORK/n8n/containers-inspect.json" 2>&1 || warn "docker inspect failed"
( cd /opt/n8n && docker compose config ) > "$WORK/n8n/compose-resolved.yml" 2>"$WORK/n8n/compose-config.err" || warn "docker compose config failed"

log "Archiving /opt/n8n"
tar czf "$WORK/n8n/opt-n8n.tar.gz" -C /opt n8n 2>"$WORK/n8n/tar-opt-n8n.err" || warn "tar /opt/n8n failed"

log "Dumping n8n Postgres"
PGUSER=$(docker exec n8n-postgres-1 printenv POSTGRES_USER)
PGDB=$(docker exec n8n-postgres-1 printenv POSTGRES_DB)
printf 'user=%s db=%s\n' "$PGUSER" "$PGDB" > "$WORK/n8n/db-params.txt"

docker exec n8n-postgres-1 pg_dump -U "$PGUSER" -d "$PGDB" --clean --if-exists \
  > "$WORK/n8n/n8n-db.sql" 2>"$WORK/n8n/pg_dump.err" || warn "pg_dump failed (see pg_dump.err)"

docker exec n8n-postgres-1 pg_dumpall -U "$PGUSER" \
  > "$WORK/n8n/n8n-db-all.sql" 2>"$WORK/n8n/pg_dumpall.err" || warn "pg_dumpall failed (non-critical, see pg_dumpall.err)"

docker exec n8n-postgres-1 psql -U "$PGUSER" -d "$PGDB" -Atc \
  "select (select count(*) from workflow_entity) as workflows, (select count(*) from credentials_entity) as credentials, (select count(*) from execution_entity) as executions;" \
  > "$WORK/n8n/db-counts.txt" 2>&1 || warn "db counts failed"

log "Exporting n8n workflows and credentials"
if docker exec n8n-n8n-1 n8n export:workflow --all --pretty --output=/tmp/workflows.json \
     > "$WORK/n8n/export-workflows.log" 2>&1; then
  docker cp n8n-n8n-1:/tmp/workflows.json "$WORK/n8n/workflows.json"
  docker exec n8n-n8n-1 rm -f /tmp/workflows.json || true
else
  warn "workflow export failed (see export-workflows.log)"
fi

if docker exec n8n-n8n-1 n8n export:credentials --all --output=/tmp/credentials.json \
     > "$WORK/n8n/export-credentials.log" 2>&1; then
  docker cp n8n-n8n-1:/tmp/credentials.json "$WORK/n8n/credentials.json"
  docker exec n8n-n8n-1 rm -f /tmp/credentials.json || true
else
  warn "credentials export failed (see export-credentials.log)"
fi

log "Archiving Docker volumes (fallback copies)"
docker run --rm --user 0:0 -v n8n_n8n_data:/data:ro -v "$WORK/n8n":/backup \
  postgres:16-alpine tar czf /backup/n8n-data-volume.tar.gz -C /data . \
  > "$WORK/n8n/volume-data.log" 2>&1 || warn "n8n data volume archive failed"

docker run --rm --user 0:0 -v n8n_postgres_data:/data:ro -v "$WORK/n8n":/backup \
  postgres:16-alpine tar czf /backup/n8n-postgres-volume.tar.gz -C /data . \
  > "$WORK/n8n/volume-postgres.log" 2>&1 || warn "n8n postgres volume archive failed"

# ---------------------------------------------------------------- readme
log "Writing README"
{
  printf '# Backup of server %s (%s)\n\n' "$(hostname)" "$TS"
  printf -- '- Created: %s\n' "$(date -Is)"
  printf -- '- OS: %s\n' "$(grep PRETTY_NAME /etc/os-release | cut -d= -f2- | tr -d '\"')"
  printf -- '- n8n: %s\n' "$(docker exec n8n-n8n-1 n8n --version 2>/dev/null || echo unknown)"
  printf -- '- PostgreSQL: %s\n' "$(docker exec n8n-postgres-1 postgres --version 2>/dev/null || echo unknown)"
  printf -- '- Counts (workflows|credentials|executions): %s\n\n' "$(cat "$WORK/n8n/db-counts.txt" 2>/dev/null || echo unknown)"
  printf '## Contents\n\n'
  printf -- '- `meta/` — ОС, пакеты, юниты, порты, firewall, cron, Docker, железо.\n'
  printf -- '- `config/etc-and-root.tar.gz` — весь `/etc` и `/root` (кроме `/root/backups` и кэшей).\n'
  printf -- '- `config/usr-local-www.tar.gz` — `/usr/local`, `/var/www`, `/home`, `/srv`.\n'
  printf -- '- `n8n/opt-n8n.tar.gz` — `/opt/n8n`: compose, `.env`, `data`, скрипты.\n'
  printf -- '- `n8n/n8n-db.sql` — `pg_dump` базы n8n (основной способ восстановления).\n'
  printf -- '- `n8n/n8n-db-all.sql` — `pg_dumpall` (роли + база), если доступен.\n'
  printf -- '- `n8n/workflows.json`, `n8n/credentials.json` — экспорт n8n CLI.\n'
  printf -- '- `n8n/n8n-data-volume.tar.gz`, `n8n/n8n-postgres-volume.tar.gz` — сырые тома (запасной вариант).\n'
  printf -- '- `n8n/compose-resolved.yml`, `n8n/containers-inspect.json` — как собрано.\n'
  printf -- '- `SHA256SUMS` — контрольные суммы файлов.\n\n'
  printf '## Restore on a new server (outline)\n\n'
  printf '1. Ubuntu 24.04 + Docker Engine + Compose plugin.\n'
  printf '2. Extract this archive to `/root/backups/`.\n'
  printf '3. Restore `/opt/n8n` from `n8n/opt-n8n.tar.gz` (keeps `.env` and compose).\n'
  printf '4. Install cloudflared if needed and restore `etc/systemd/system/cloudflared-n8n.service` from the config archive.\n'
  printf '5. `cd /opt/n8n && docker compose up -d postgres`\n'
  printf '6. Restore DB: `docker exec -i n8n-postgres-1 psql -U n8n -d n8n < n8n/n8n-db.sql`\n'
  printf '7. `docker compose up -d` and open `http://127.0.0.1:5678`.\n'
  printf '8. Credentials need the same `N8N_ENCRYPTION_KEY` as in `/opt/n8n/.env`.\n\n'
  printf '## Security\n\n'
  printf 'This archive contains secrets: `.env`, DB password, `N8N_ENCRYPTION_KEY`, SSH keys, `/etc/shadow`, possibly a Cloudflare token.\n'
  printf 'Keep it `chmod 600`, never commit to git, store an encrypted copy off-site.\n'
  printf '\nA provider-level VPS snapshot is the most exact backup of the whole disk; this archive is the portable logical backup.\n'
} > "$WORK/README.md"

# ---------------------------------------------------------------- checksums
log "Checksums"
chmod -R go-rwx "$WORK"
# backup.log продолжает писаться через tee, поэтому его сумма не входит в манифест
( cd "$WORK" && find . -type f ! -name SHA256SUMS ! -name backup.log -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS )

log "Creating archive"
tar czf "$ARCHIVE" -C "$BASE" "server-$TS"
chmod 600 "$ARCHIVE"
( cd "$BASE" && sha256sum "server-$TS.tar.gz" > "server-$TS.tar.gz.sha256" )
chmod 600 "$ARCHIVE.sha256"

log "Done"
du -sh "$WORK" "$ARCHIVE"
ls -lh "$ARCHIVE" "$ARCHIVE.sha256"
printf 'Files in archive: '
tar -tzf "$ARCHIVE" | wc -l
printf 'Counts (workflows|credentials|executions): '
cat "$WORK/n8n/db-counts.txt" 2>/dev/null || echo unknown
printf '\nArchive: %s\n' "$ARCHIVE"
printf 'Do not commit this archive. It contains secrets.\n'
