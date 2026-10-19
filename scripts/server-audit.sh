#!/usr/bin/env bash
# StayNest: read-only inventory of a server before cleanup.
# Ничего не меняет: только читает состояние системы и пишет отчёт.
#
# Usage:
#   sudo bash scripts/server-audit.sh
#
# Отчёт: /tmp/staynest-audit-YYYYmmdd-HHMMSS.txt
# Секреты (.env, ключи, пароли) скрипт НЕ читает и НЕ печатает.

set -u
export LC_ALL=C

REPORT="/tmp/staynest-audit-$(date +%Y%m%d-%H%M%S).txt"
exec > >(tee -a "$REPORT") 2>&1

section() { printf '\n===== %s =====\n' "$1"; }
hint()    { printf '(нет данных или команда недоступна)\n'; }

printf 'StayNest server audit\n'
printf 'Report: %s\n' "$REPORT"
date -Is

section "1. Система"
id
hostname
uname -a
cat /etc/os-release 2>/dev/null || hint
uptime
printf '\nCPU: '; nproc
free -h 2>/dev/null || hint
df -hT 2>/dev/null || hint

section "2. Кто в системе"
who 2>/dev/null || hint
printf '\nПользователи с shell:\n'
awk -F: '$7 !~ /(nologin|false)$/ {print $1" (uid="$3", shell="$7")"}' /etc/passwd 2>/dev/null || hint
printf '\nПоследние входы:\n'
last -n 10 2>/dev/null || hint

section "3. Слушающие порты"
ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || hint

section "4. Systemd: запущенные и упавшие юниты"
systemctl list-units --type=service --state=running --no-pager 2>/dev/null || hint
printf '\nУпавшие:\n'
systemctl --failed --no-pager 2>/dev/null || hint
printf '\nНестандартные unit-файлы в /etc/systemd/system:\n'
find /etc/systemd/system -maxdepth 2 -name '*.service' -printf '%p\n' 2>/dev/null || hint

section "5. Docker"
if command -v docker >/dev/null 2>&1; then
  docker version --format 'Server: {{.Server.Version}}' 2>/dev/null || hint
  printf '\nКонтейнеры (все):\n'
  docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}\t{{.Labels}}' 2>/dev/null || hint
  printf '\nОбразы:\n'
  docker images --format 'table {{.Repository}}:{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}' 2>/dev/null || hint
  printf '\nТома:\n'
  docker volume ls 2>/dev/null || hint
  printf '\nСети:\n'
  docker network ls 2>/dev/null || hint
  printf '\nЗанято местом:\n'
  docker system df 2>/dev/null || hint
  printf '\nCompose-проекты:\n'
  docker compose ls -a 2>/dev/null || docker-compose ls -a 2>/dev/null || hint
else
  printf 'docker не установлен\n'
fi

section "6. Веб-серверы и сертификаты"
for svc in caddy nginx apache2 httpd; do
  if systemctl list-unit-files 2>/dev/null | grep -q "^${svc}\.service"; then
    printf '%s: ' "$svc"
    systemctl is-active "$svc" 2>/dev/null || true
  fi
done
printf '\nКонфиги Caddy:\n'
ls -la /etc/caddy 2>/dev/null || hint
printf '\nСайты nginx:\n'
ls -la /etc/nginx/sites-enabled 2>/dev/null || hint
printf '\nСертификаты certbot:\n'
certbot certificates 2>/dev/null || hint

section "7. Базы данных"
docker ps --format '{{.Names}}\t{{.Image}}' 2>/dev/null | grep -Ei 'postgres|mysql|maria|mongo|redis' || true
command -v psql >/dev/null 2>&1 && psql --version || true
if command -v psql >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
  printf '\nСписок баз Postgres (только имена, без данных):\n'
  su - postgres -c "psql -Atc \"select datname from pg_database order by 1\"" 2>/dev/null || hint
fi
printf '\nКаталоги данных:\n'
ls -d /var/lib/postgresql* /var/lib/mysql* /var/lib/mongodb* 2>/dev/null || hint

section "8. Проекты и данные на диске"
for dir in /var/www /opt /srv /home /root; do
  printf '\n--- %s ---\n' "$dir"
  du -sh "$dir" 2>/dev/null || hint
  ls -la "$dir" 2>/dev/null | head -n 40 || hint
done
printf '\nCompose-файлы вне стандартных путей:\n'
find /opt /srv /var/www /home /root -maxdepth 4 \
  \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' -o -name 'compose.yml' -o -name 'compose.yaml' \) \
  -not -path '*/node_modules/*' -printf '%p\n' 2>/dev/null | head -n 50 || hint
printf '\nКрупнейшие каталоги / (top-15):\n'
du -xhd1 / 2>/dev/null | sort -rh | head -n 15 || hint

section "9. Планировщики"
crontab -l 2>/dev/null || hint
printf '\n/etc/cron.d:\n'
ls -la /etc/cron.d 2>/dev/null || hint
printf '\nТаймеры systemd:\n'
systemctl list-timers --all --no-pager 2>/dev/null || hint

section "10. Файрвол"
if command -v ufw >/dev/null 2>&1; then ufw status verbose 2>/dev/null || hint; fi
if command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --list-all 2>/dev/null || hint; fi
iptables -S 2>/dev/null | head -n 60 || hint

section "11. SSH-конфигурация (без ключей)"
sshd -T 2>/dev/null | grep -Ei '^(port|permitrootlogin|passwordauthentication|pubkeyauthentication|allowusers)' || hint

section "12. Обновления и перезагрузка"
[ -f /var/run/reboot-required ] && printf 'Требуется перезагрузка\n' || printf 'Перезагрузка не требуется\n'
if command -v apt >/dev/null 2>&1; then
  printf '\nДоступные обновления (кратко):\n'
  apt list --upgradable 2>/dev/null | head -n 30 || hint
fi

section "13. Итог"
printf 'Контейнеров всего: '; docker ps -aq 2>/dev/null | wc -l
printf 'Томов Docker: ';      docker volume ls -q 2>/dev/null | wc -l
printf 'Свободно на /: ';     df -h / 2>/dev/null | awk 'NR==2 {print $4}' || true
printf '\nОтчёт сохранён: %s\n' "$REPORT"
printf 'Секреты не читались. Перед удалением сделайте бэкап и подтвердите список.\n'
