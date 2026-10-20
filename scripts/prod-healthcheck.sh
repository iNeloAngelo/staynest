#!/usr/bin/env bash
# Проверка живости стенда. Запускается systemd-таймером staynest-health.timer.
# Проверяет: /health API, запущенные контейнеры, свободное место, свежесть бэкапа.
# При ошибке пишет в journal и, если задан HEALTHCHECK_WEBHOOK_URL, шлёт POST.
#
# Переменные (/etc/staynest/health.env):
#   HEALTHCHECK_DOMAIN=example.com
#   HEALTHCHECK_WEBHOOK_URL=          необязательный webhook (Slack/Discord/свой)
set -euo pipefail

REPO_DIR="/opt/staynest"
cd "$REPO_DIR"

# shellcheck disable=SC1091
[[ -f /etc/staynest/health.env ]] && source /etc/staynest/health.env

DOMAIN="${HEALTHCHECK_DOMAIN:-$(grep -E '^DOMAIN=' .env 2>/dev/null | cut -d= -f2- | tr -d '"')}"
HEALTHCHECK_WEBHOOK_URL="${HEALTHCHECK_WEBHOOK_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-/home/deploy/backups/staynest}"
COMPOSE=(docker compose --env-file .env -f infra/docker-compose.prod.yml)

problems=()

if [[ -z "$DOMAIN" ]]; then
  problems+=("DOMAIN не задан")
else
  if ! BODY="$(curl -fsS --max-time 10 "https://$DOMAIN/api/v1/health")"; then
    problems+=("health: нет ответа")
  elif ! grep -q '"status":"ok"' <<<"$BODY" || ! grep -q '"db":"up"' <<<"$BODY"; then
    problems+=("health: $BODY")
  fi
fi

expected=(caddy api worker postgres silo mailpit)
running="$("${COMPOSE[@]}" ps --status running --format '{{.Service}}' 2>/dev/null || true)"
for service in "${expected[@]}"; do
  grep -qx "$service" <<<"$running" || problems+=("контейнер $service не запущен")
done

DISK_USED="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [[ -n "$DISK_USED" && "$DISK_USED" -ge 85 ]]; then
  problems+=("диск занят на ${DISK_USED}%")
fi

NEWEST_BACKUP="$(find "$BACKUP_DIR/daily" -maxdepth 1 -name 'staynest-*.dump' -printf '%T@\n' 2>/dev/null | sort -n | tail -1 | cut -d. -f1)"
if [[ -z "$NEWEST_BACKUP" ]]; then
  problems+=("нет ни одного бэкапа в $BACKUP_DIR/daily")
else
  AGE_HOURS=$(( ( $(date +%s) - NEWEST_BACKUP ) / 3600 ))
  if (( AGE_HOURS > 26 )); then
    problems+=("последний бэкап ${AGE_HOURS} ч назад")
  fi
fi

if (( ${#problems[@]} == 0 )); then
  echo "ok: $DOMAIN"
  exit 0
fi

MESSAGE="StayNest $DOMAIN: $(IFS='; '; echo "${problems[*]}")"
echo "FAIL: $MESSAGE" >&2
logger -t staynest-health "$MESSAGE" || true

if [[ -n "$HEALTHCHECK_WEBHOOK_URL" ]]; then
  escaped="$(printf '%s' "$MESSAGE" | sed 's/\\/\\\\/g; s/"/\\"/g')"
  curl -fsS --max-time 10 -X POST -H 'Content-Type: application/json' \
    -d "{\"text\":\"$escaped\"}" "$HEALTHCHECK_WEBHOOK_URL" >/dev/null || true
fi

exit 1
