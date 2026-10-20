# OPS: сервер StayNest

Документ описывает подготовку сервера, очистку от старого содержимого, деплой, бэкапы и восстановление.
Обновляется в Сессии 17; раздел про очистку актуален с самого начала.
## 1. Принципы

1. **Сначала смотрим, потом удаляем.** Любое удаление — только после отчёта инвентаризации и явного подтверждения владельца.
2. **Перед удалением — бэкап.** Даже если кажется, что данные не нужны. Бэкап хранится вне сервера.
3. **Секреты не в git и не в чате.** Пароли БД, ключи MinIO, VAPID-ключи живут только в `.env` на сервере (права `600`) и в `.env.example` без значений.
4. **Наружу только 22, 80, 443.** Postgres, MinIO-консоль, API-порты — только внутри docker-сети.
5. **Ничего не удаляем на проде без окна простоя.** Очистка — это остановка сервиса.

## 1.1. Текущее состояние сервера (2026-10-19)

- Хост `olivertwist95.clodocd.com`, Ubuntu 24.04.5 LTS, 1 vCPU, 1.8 ГБ RAM, 40 ГБ SSD (свободно ~34 ГБ).
- Старое содержимое удалено: n8n, его Postgres, тома, образы и Cloudflare quick tunnel. Контейнеров и томов нет, порт 5678 закрыт.
- Перед удалением сделан проверенный бэкап: `/root/backups/server-20261017-100153.tar.gz` (143 МБ, sha256 `53658291…385a59`), локальная копия — `C:\Users\User\staynest-backup\`. Архив содержит секреты, в git не попадает.
- UFW: только 22/80/443, входящие по умолчанию запрещены. SSH: только ключи, `PasswordAuthentication no`, `PermitRootLogin prohibit-password`.
- `fail2ban` активен (jail sshd), время сервера — UTC, `unattended-upgrades` включён.
- 2026-10-19: добавлен swap-файл `/swapfile` 2 ГБ (прописан в `/etc/fstab`).
- 2026-10-19: создан пользователь `deploy` (sudo + docker, вход по тому же SSH-ключу). Root-доступ по ключу пока оставлен и закрывается в Сессии 17.
- 2026-10-19: репозиторий склонирован в `/opt/staynest`; доступ к GitHub — read-only deploy key `~deploy/.ssh/github_deploy`, `git pull` работает.
- 2026-10-19: поднят контур `caddy + api + postgres + silo + mailpit` (`infra/docker-compose.prod.yml`, проект `staynest`). Сайт: `https://olivertwist95.clodocd.com`, TLS Let's Encrypt, наружу только 80/443. Фактическое потребление памяти ~275 МБ.
- 2026-10-19 (С11): в compose добавлен `worker` (тот же образ, `node dist/worker.js`) для pg-boss-джоб бронирования. При следующем деплое контейнеров станет на один больше; схему `pgboss` создаёт сам pg-boss, в миграциях её нет.
- Postgres слушает только `127.0.0.1:5433`; базы `staynest` и `staynest_test`. С машины разработчика доступ через SSH-туннель (ADR-027), локальный Docker не используется. Секреты в `/opt/staynest/.env` (600, владелец `deploy`).
- Деплой одной командой: `scripts/deploy.sh` (fetch, checkout --detach, pre-deploy бэкап, сборка, миграции, перезапуск, health).
- 2026-10-20 (С17): на стенд выкачены Сессии 5–16, применены миграции `0008`–`0010`, загружены демо-данные (`pnpm seed:demo`: 14 домов, 13 броней, 2 аккаунта). Исправлена раздача `/media` в Caddy: ключ объекта больше не содержит префикс `/media`.
- 2026-10-20 (С17): контур переведён на три сети — `edge` (только Caddy), `internal` (API, worker, Postgres, Silo, Mailpit, без выхода наружу) и `ops` (только loopback-публикация Postgres и Mailpit). У API, worker и Caddy сброшены capabilities, включены `no-new-privileges`, read-only rootfs и лимиты логов. API и worker работают от пользователя `node`.
- 2026-10-20 (С17): Postgres доступен только на `127.0.0.1:5433`, Mailpit UI — на `127.0.0.1:8025`. Оба порта смотрятся через SSH-туннель, наружу не публикуются.
- 2026-10-20 (С17): root-доступ по SSH закрыт (`PermitRootLogin no`), вход только пользователем `deploy` по ключу. `fail2ban`, UFW (22/80/443), `unattended-upgrades` активны. Внешняя проверка `check-host.net` подтвердила, что 5432/5433/8025/9000/3100 снаружи закрыты.
- 2026-10-20 (С17): ежедневный бэкап БД и бакета настроен systemd-таймером, проверка восстановления и offsite-копия выполнены (раздел 11). Мониторинг `/health` — таймер каждые 5 минут (раздел 12).
- 2026-10-20 (С17): CI/CD выкатывает тег `v*` или кнопку `workflow_dispatch` (раздел 13).
- 2026-10-20 (С19): добавлена опциональная интеграция Telegram Mini App: вход по
  HMAC-подписанному `initData`, вебхук бота и уведомления о бронях. Реального
  токена бота на стенде нет, поэтому канал выключен; PWA и вход по email работают.
  `deploy.sh` теперь сам генерирует заглушечный `PAYMENT_WEBHOOK_SECRET` для
  мок-провайдера: без него API в production не стартовал (fail-closed).
  CSP Caddy разрешает `frame-ancestors` только `web.telegram.org` и `*.telegram.org`. Секреты `DEPLOY_*` добавлены в GitHub Actions.

## 2. Целевая конфигурация

Из `docs/TZ.md` (раздел 10) и `docs/SECURITY.md` (раздел 7):

- VPS: Ubuntu 24.04 LTS, 2 vCPU, 2–4 ГБ RAM, 40+ ГБ SSD.
- Пользователь `deploy` без root, вход по SSH-ключу, root-логин и пароли отключены.
- Docker Engine + Compose plugin; рабочая папка `/opt/staynest`.
- `infra/docker-compose.prod.yml`: `caddy`, `api`, `worker`, `postgres`, `silo` (S3-совместимый Silo, см. ADR-021).
- Caddy: автоматический TLS, заголовки безопасности, `flush_interval -1` для SSE.
- Firewall: 22/80/443 + fail2ban + unattended-upgrades.
- Бэкап: ежедневный `pg_dump` с ротацией, копия вне сервера, бэкап S3-бакета, **проверенное** восстановление.

## 2.1. Staging-доступ с машины разработчика

Локальный Docker не нужен: Postgres работает на VPS и слушает только loopback. Перед работой с БД поднимите туннель и оставьте его открытым:

```powershell
ssh -N -L 5433:127.0.0.1:5433 staynest
```

После этого `.env` работает как обычно (`localhost:5433`):

```bash
pnpm db:reset        # база staynest
pnpm db:reset:test   # база staynest_test
pnpm test
```

Проверка соединения: `pnpm db:migrate` должен напечатать «Готово» без ошибок. Если туннель закрыт, команды завершатся ошибкой подключения к `localhost:5433`.

`db:reset` сбрасывает базу из `DATABASE_URL`, `db:reset:test` — из `DATABASE_URL_TEST` и отказывается работать, если имя базы не оканчивается на `_test`. Оба скрипта завершают чужие подключения к целевой базе и могут на несколько секунд прервать работу запущенного API. Останавливайте API перед сбросом.

## 3. Инвентаризация (шаг 0)

Выполняется до любых изменений. Скрипт только читает систему.

```bash
sudo bash scripts/server-audit.sh
```

Скрипт собирает: ОС и ресурсы, пользователей, слушающие порты, systemd-юниты, контейнеры/образы/тома/сети Docker, compose-проекты, веб-серверы и сертификаты, базы данных (только имена), каталоги проектов, cron/таймеры, firewall, настройки SSH, обновления. Отчёт пишется в `/tmp/staynest-audit-*.txt`, `.env` и ключи не читаются.

По отчёту заполняется список «что удаляем / что сохраняем». Без этого списка очистка не начинается.

## 4. Варианты очистки

### Вариант A. Переустановка ОС из панели провайдера (рекомендуется)

Самый предсказуемый «чистый лист»: не остаётся ни старых пакетов, ни контейнеров, ни юнитов, ни пользователей.
Минусы: нужен доступ к панели провайдера; старые данные исчезают полностью (поэтому сначала бэкап, если что-то нужно).
После переустановки — раздел 6.

### Вариант B. Мягкая очистка без переустановки

Порядок строго такой:

1. **Бэкап** того, что решили сохранить (раздел 5).
2. **Остановить старые приложения:** `docker compose down` в каждом найденном проекте (без `-v`).
3. **Удалить контейнеры, образы, тома, сети** — только после подтверждения списка. `docker compose down -v` и `docker volume rm` **удаляют данные безвозвратно**.
4. **Удалить каталоги старых проектов** (`/var/www/*`, `/opt/*`, `/srv/*` — по списку из отчёта).
5. **Отключить старые веб-серверы и юниты** (`nginx`, `apache2`, сторонние `*.service`), убрать их из автозапуска.
6. **Освободить 80/443**, проверить `ss -tulpn`.
7. **Не трогать:** SSH, firewall, системных пользователей, пакеты ОС, `/etc/ssh`, текущий доступ.

Проверка чистоты:

```bash
ss -tulpn | grep -E ':(80|443)\b'   # пусто
docker ps -a                        # пусто (или не установлен docker)
docker volume ls                    # пусто
systemctl --failed                  # пусто
df -h /
```

Если после очистки порты 80/443 заняты — найти владельца (`ss -tulpn`, `systemctl status`, `docker ps`) и остановить его, а не убивать процесс вслепую.

## 5. Бэкап перед очисткой

Что сохраняем (по согласованию): базы (`pg_dump`/`pg_dumpall`), тома Docker, `.env` старых проектов (только на машину владельца, не в git), файлы приложений, сертификаты.

Примеры:

```bash
# Postgres в контейнере
docker exec <pg_container> pg_dumpall -U postgres > /root/backup/pg_all_$(date +%F).sql

# Том Docker
docker run --rm -v <volume>:/data -v /root/backup:/backup alpine \
  tar czf /backup/<volume>_$(date +%F).tar.gz -C /data .

# Каталог проекта без node_modules
tar czf /root/backup/app_$(date +%F).tar.gz --exclude=node_modules -C /var/www <project>
```

Бэкап скачивается на локальную машину, затем проверяется (`pg_restore --list`, распаковка архива).

## 6. Базовая подготовка чистого сервера

Выполняется один раз, до деплоя:

```bash
apt update && apt upgrade -y
timedatectl set-timezone UTC
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
# SSH-ключ владельца в /home/deploy/.ssh/authorized_keys (права 700/600)
# В /etc/ssh/sshd_config.d/00-staynest.conf (первый файл побеждает!):
#   PermitRootLogin no
#   PasswordAuthentication no
#   PubkeyAuthentication yes
#   X11Forwarding no
#   AllowAgentForwarding no
#   AllowTcpForwarding local
systemctl restart ssh
# Проверка: sshd -T | grep -E 'permitrootlogin|passwordauthentication|allowtcpforwarding'
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
apt install -y fail2ban unattended-upgrades
# Docker Engine + compose plugin по официальной инструкции, затем:
usermod -aG docker deploy
mkdir -p /opt/staynest && chown deploy:deploy /opt/staynest
```

Проверка: вход `deploy` по ключу, `sudo` работает, `ssh root@` и вход по паролю отклоняются, `ufw status` — только 22/80/443, `docker run --rm hello-world` работает от `deploy`.

## 7. Деплой

Стенд уже работает: `https://olivertwist95.clodocd.com`. Код лежит в `/opt/staynest`, вход по SSH-ключу пользователем `deploy`, доступ к GitHub — через read-only deploy key (`~deploy/.ssh/github_deploy`), к Docker — через группу `docker`.

1. Код на сервере всегда выкатывается скриптом: `./scripts/deploy.sh` (origin/main) или `DEPLOY_REF=v1.2.3 ./scripts/deploy.sh` (тег/ветка/коммит). Скрипт сам делает `git fetch` + `checkout --detach`, поэтому ручной `git pull --ff-only` на стенде не используется: после CI-выкатки репозиторий намеренно в detached HEAD.
2. `.env` лежит рядом с репозиторием (права `600`, владелец `deploy`). Полный минимум для production:

```dotenv
NODE_ENV=production
DOMAIN=example.com
TRUST_PROXY=true
DATABASE_URL=postgres://staynest:<пароль>@postgres:5432/staynest
POSTGRES_USER=staynest
POSTGRES_PASSWORD=<пароль>
POSTGRES_DB=staynest
CORS_ORIGINS=https://example.com
APP_WEB_URL=https://example.com
JWT_SECRET=<openssl rand -base64 48>
REQUIRE_EMAIL_VERIFICATION=true
PAYMENT_MOCK_ENABLED=true
PAYMENT_DEPOSIT_PERCENT=20
PAYMENT_DEPOSIT_TTL_HOURS=48
PAYMENT_WEBHOOK_SECRET=<openssl rand -base64 48>
# Telegram Mini App: без токена канал выключен, PWA работает как обычно
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_INITDATA_MAX_AGE_SECONDS=900
SMTP_HOST=mailpit
SMTP_PORT=1025
S3_ENDPOINT=http://silo:9000
S3_BUCKET=staynest-media
MINIO_ROOT_USER=staynest
MINIO_ROOT_PASSWORD=<пароль>
# VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT — по желанию
```

`.env.example` — только dev-шаблон: значения `staynest`/`staynest-minio` и `S3_ENDPOINT=http://localhost:9000` в production недопустимы, внутри compose S3-хост — `silo`.
3. Сборка образов, миграции **отдельной командой**, затем `docker compose up -d`. Перед сборкой `deploy.sh` автоматически делает свежий зашифрованный бэкап (раздел 11); при неудачном бэкапе выкатка останавливается.
4. Проверка: `/api/v1/health` отвечает `ok` с `db: up`, сайт по HTTPS, демо-сценарий.
5. Бэкап-джоб и проверенное восстановление — раздел 11.

Выкатка одной командой:

```bash
ssh staynest
cd /opt/staynest && ./scripts/deploy.sh
```

Скрипт делает `git fetch` + `checkout --detach` указанной ссылки (по умолчанию `origin/main`), печатает предыдущий и новый commit, делает бэкап, собирает образы, поднимает Postgres, применяет миграции (`node dist/migrate.js` внутри образа API), перезапускает контур и ждёт `{"db":"up"}` от `/health`. Простой на время пересборки и миграции — секунды-десятки секунд.

**Откат.** Миграции в проекте только вперёд: `migrate` умеет `up`, но не `down`. Если релиз не менял схему, можно вернуть код: `DEPLOY_REF=<предыдущий commit> ./scripts/deploy.sh`. Если менял — сначала остановите API/worker, восстановите БД из pre-deploy бэкапа (раздел 11.4), затем выкатите старый код. `deploy.sh` при провале health-check печатает предыдущий commit и команду возврата, но сам не откатывается; pre-deploy бэкап всё равно обязателен.

## 8. Доступ агента к серверу и секреты

Цель: агент умеет подключаться и работать, но приватный ключ не попадает ни в git, ни в чат, ни в отчёты, ни к посторонним.

### 8.1 Правило

**Приватный ключ — отдельный файл вне репозитория, права только у владельца.** Это и есть аналог `600` (на Linux `chmod 600`, на Windows — ACL). В git попадает только публичная часть ключа или ничего.

- Ключ лежит, например, в `C:\Users\User\.ssh\staynest_deploy` — **не** в `D:\Projects\PWA`.
- Агент передаёт путь к файлу через `ssh -i`, но **никогда не читает и не печатает содержимое**.
- `.gitignore` уже исключает `.env`, `*.key`, `id_*`, `.ssh/`, `*.pem`.
- Ключ создаётся **отдельный, только для этого сервера**, а не основной личный ключ.

### 8.2 Вариант 1 — отдельный ключ без пароля (проще всего)

Подходит, если файл защищён ACL и ключ серверный, а не личный.

```powershell
# 1. Сгенерировать пару (ключ без пароля)
ssh-keygen -t ed25519 -a 100 -C "staynest-deploy" -f "$env:USERPROFILE\.ssh\staynest_deploy"

# 2. Закрыть доступ всем, кроме текущего пользователя (аналог chmod 600)
icacls "$env:USERPROFILE\.ssh\staynest_deploy" /inheritance:r
icacls "$env:USERPROFILE\.ssh\staynest_deploy" /grant:r "$($env:USERNAME):(R)"

# 3. Публичный ключ добавить на сервер (через панель провайдера или authorized_keys)
Get-Content "$env:USERPROFILE\.ssh\staynest_deploy.pub"
```

Проверка прав: в свойствах файла → Security должна быть только одна запись — ваш пользователь.

### 8.3 Вариант 2 — ключ с паролем и ssh-agent (строже)

Приватный ключ зашифрован, пароль вводится один раз в агент Windows.

```powershell
ssh-keygen -t ed25519 -a 100 -C "staynest-deploy" -f "$env:USERPROFILE\.ssh\staynest_deploy"
Set-Service ssh-agent -StartupType Automatic
Start-Service ssh-agent
ssh-add "$env:USERPROFILE\.ssh\staynest_deploy"   # спросит пароль один раз
```

Дальше агент использует ключ из ssh-agent, пароль в чат не передаётся. Минус: после перезагрузки нужно снова `ssh-add`.

### 8.4 Вариант 3 — пароль (не рекомендуется)

Пароль в переписке считается раскрытым. Допустим только как разовый вход, чтобы сразу положить ключ на сервер и отключить вход по паролю. После этого пароль меняется.

### 8.5 Ограничения на стороне сервера

В `~/.ssh/authorized_keys` ключ можно ограничить:

```
# CI-ключ: только деплой, без туннелей
from="IP-РАННЕРА",no-agent-forwarding,no-port-forwarding,no-x11-forwarding ssh-ed25519 AAAA... staynest-ci
# Ключ оператора: нужны -L 5433 и -L 8025, поэтому port-forwarding разрешён
from="ВАШ.IP.АДРЕС",no-agent-forwarding,no-x11-forwarding ssh-ed25519 AAAA... staynest-deploy
```

Для первичной очистки обычно нужен `root` или пользователь с `sudo`/`docker`. После очистки:

1. создать `deploy`, положить его ключ;
2. отключить `PermitRootLogin` и `PasswordAuthentication`;
3. проверить вход `deploy` по ключу;
4. только потом закрывать root-доступ.

### 8.6 Чего агент не делает

- не выводит содержимое ключей, `.env`, токенов и паролей в чат и в логи;
- не коммитит секреты и не кладёт их в `AGENTS.md`, `docs/`, тесты, примеры;
- не хранит секреты в переменных, которые попадают в отчёт;
- при работе с `.env` на сервере использует `install -m 600` и не печатает файл целиком.

История чата и логи терминала — **не хранилище секретов**. Если ключ или пароль всё же попали в переписку, они считаются скомпрометированными: ключ перевыпускается, пароль меняется.

## 9. Бэкап сервера перед миграцией (историческое)

Этот раздел относится к переносу старого сервера (n8n) и оставлен для истории.
После Сессии 17 root-SSH закрыт, поэтому команды с `/root` больше не работают;
для аварийного доступа используйте панель провайдера. Для регулярных бэкапов
StayNest используйте раздел 11.

`scripts/server-backup.sh` делает переносимый логический бэкап, не останавливая сервисы (запускался от root до закрытия root-доступа):

```bash
scp scripts/server-backup.sh staynest:/root/server-backup.sh
ssh staynest "chmod 700 /root/server-backup.sh && bash /root/server-backup.sh"
```

Результат: `/root/backups/server-<timestamp>.tar.gz` (600) + `.sha256`.

Что входит: `/etc` и `/root`, `/usr/local`, `/var/www`, `/opt/n8n` (compose, `.env`, данные), дампы Postgres (`pg_dump` и `pg_dumpall`), экспорт workflows и credentials через n8n CLI, сырые Docker-тома, метаданные системы и Docker, README с порядком восстановления.

Проверка после создания:

```bash
cd /root/backups/server-<timestamp>
sha256sum -c SHA256SUMS
cd .. && sha256sum -c server-<timestamp>.tar.gz.sha256
```

Дамп БД дополнительно проверяется восстановлением в одноразовый контейнер Postgres: количество workflows/credentials/executions должно совпасть с продом.

Ограничения:
- архив содержит секреты (`.env`, пароль БД, `N8N_ENCRYPTION_KEY`, SSH-ключи, `/etc/shadow`) — хранить только у владельца, в git не коммитить;
- credentials.json зашифрован ключом `N8N_ENCRYPTION_KEY`; при восстановлении ключ должен быть тем же;
- Cloudflare quick tunnel (`trycloudflare.com`) не переносит URL: после перезапуска на новом сервере адрес изменится, нужно снова выполнить `sync-tunnel-url.sh` и обновить вебхук Telegram;
- образы Docker (2.2 ГБ) в архив не входят: они скачиваются заново, версии зафиксированы в `meta/docker-images.txt`;
- provider-level snapshot диска — самый точный бэкап, но менее переносимый между провайдерами. Для миграции нужен именно логический архив.

## 10. Данные, которые нужны от владельца

- IP/хост, SSH-порт, пользователь, способ входа (ключ или пароль).
- Провайдер и доступ к панели (если возможна переустановка ОС).
- Домен и доступ к DNS (A/AAAA-записи).
- Что сейчас на сервере и что из этого нужно сохранить.
- Согласованное окно простоя.

## 11. Бэкапы и проверенное восстановление

### 11.1. Что и куда бэкапится

Ежедневно в **02:30 UTC** systemd-таймер `staynest-backup.timer` запускает
`scripts/prod-backup.sh` от пользователя `deploy`:

| Артефакт | Формат | Путь |
|---|---|---|
| База `staynest` | `pg_dump --format=custom -Z6`, затем age | `/home/deploy/backups/staynest/daily/staynest-<stamp>.dump.age` |
| Роли и настройки | `pg_dumpall --globals-only`, затем age | `staynest-globals-<stamp>.sql.age` |
| Бакет Silo | `tar.gz` тома `/data`, затем age | `staynest-silo-<stamp>.tar.gz.age` |
| Контрольные суммы | SHA-256 от `.age` | `*.sha256` |
| Результат restore-check | счётчики строк (без PII) | `*.restore-check.txt` |

Скрипт делает `pg_restore --list`, восстанавливает дамп в отдельную базу
`staynest_restore_check`, сравнивает количество `users`, `listings`, `bookings`
с рабочей базой и удаляет проверочную базу. Если счётчики разошлись, бэкап
считается неудачным (exit 1). **Шифрование** выполняется после restore-check:
`age` публичным ключом из `/home/deploy/backups/staynest/age-recipient.txt`;
незашифрованные `.dump`/`.sql`/`.tar.gz` удаляются. Без `age` или recipient-файла
скрипт падает, а не оставляет PII на диске.

**Ключи.** Публичный ключ лежит на сервере (`age-recipient.txt`, 600).
Приватный `age-identity.txt` хранится **только вне сервера**, у владельца
(`C:\Users\User\staynest-backups\age-identity.txt`, ACL только для пользователя).
На сервере его нет — компрометация VPS не даёт расшифровать архив. Потеря
приватного ключа означает потерю всех бэкапов, поэтому ключ нужно продублировать
в менеджере паролей/офлайн-хранилище.

Ретенция: 7 дневных копий, по воскресеньям — ещё и недельная (хранится 4 недели).
Каталог `700`, файлы `600`, владелец `deploy`.

**Установка age на сервере.** Статический бинарник кладётся в
`/home/deploy/bin/age` (без root). Пример для v1.3.2 (сверяйте версию и
контрольную сумму с релизом):

```bash
mkdir -p ~/bin ~/backups/staynest
cd /tmp && curl -fsSLO https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz
tar xzf age-v1.3.2-linux-amd64.tar.gz
install -m 755 age/age ~/bin/age
install -m 755 age/age-keygen ~/bin/age-keygen
```

Ключ создаётся **на машине владельца**, публичная часть копируется на сервер:

```bash
age-keygen -o age-identity.txt                  # приватный, хранить только локально
age-keygen -y age-identity.txt > age-recipient.txt
scp age-recipient.txt staynest:/home/deploy/backups/staynest/age-recipient.txt
ssh staynest 'chmod 600 /home/deploy/backups/staynest/age-recipient.txt'
```

Проверка: `./scripts/prod-backup.sh` должен создать `.dump.age` и не оставить
рядом `.dump`. На сервере после этого не должно быть `age-identity.txt`.

### 11.2. Ручной запуск и offsite-копия

```bash
ssh staynest
cd /opt/staynest
./scripts/prod-backup.sh          # запуск вручную, от deploy
systemctl list-timers | grep staynest
```

Копия вне сервера забирается на машину разработчика:

```powershell
powershell -File scripts/pull-backups.ps1
```

Скрипт скачивает зашифрованные дамп, globals, бэкап бакета, restore-check и
SHA-256, проверяет **обе** контрольные суммы и кладёт всё в
`C:\Users\User\staynest-backups\<stamp>`. Ошибка `scp` или отсутствие любого
артефакта — это ошибка, а не «готово». Старые локальные копии старше 30 дней
удаляются; приватный age-ключ не удаляется.

Расшифровка (age для Windows лежит в
`C:\Users\User\staynest-backups\tools\age\age\age.exe`):

```powershell
$age = "$env:USERPROFILE\staynest-backups\tools\age\age\age.exe"
$key = "$env:USERPROFILE\staynest-backups\age-identity.txt"
& $age -d -i $key -o staynest.dump .\<stamp>\staynest-<stamp>.dump.age
```

Для регулярной offsite-копии можно указать `BACKUP_REMOTE` в
`/etc/staynest/backup.env` и установить `rclone`; скрипт скопирует `.age`-файлы
в удалённое хранилище. Для ротации удалённых копий настройте lifecycle policy
у провайдера (скрипт remote-объекты не удаляет).

После изменения юнитов в `infra/systemd/` их нужно установить заново (от
пользователя с sudo) и включить автозапуск:

```bash
sudo install -m 644 infra/systemd/staynest-*.service infra/systemd/staynest-*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now staynest-backup.timer staynest-health.timer
sudo systemctl restart staynest-backup.timer staynest-health.timer
```

### 11.3. Проверка 2026-10-20

- Бэкап создан: `staynest-20261020T114242Z.dump` (116 КБ) и
  `staynest-silo-20261020T114242Z.tar.gz` (7.0 МБ); после включения age
  артефакты шифруются в `.dump.age` / `.tar.gz.age`.
- Restore-check: `users=10 listings=17 bookings=13` — совпало с рабочей базой (10-й пользователь — тестовая регистрация С17).
- Offsite-копия скачана на Windows, SHA-256 дампа и бакета сошлись.
- Зашифрованный дамп из offsite-копии расшифрован локальным age-ключом и восстановлен
  на сервере в отдельную базу `staynest_offsite_check`: `10 users, 17 listings,
  13 bookings`. База удалена после проверки.

### 11.4. Восстановление вручную

Приватного ключа на сервере нет, поэтому сначала расшифровываем на машине
владельца (команда в 11.2), затем передаём plaintext-дамп на сервер. Восстановление
делается в отдельную базу, а не поверх живой:

```bash
# 1. Расшифровать локально и передать на сервер
scp staynest.dump staynest:/home/deploy/restore.dump

ssh staynest
cd /opt/staynest
COMPOSE=(docker compose --env-file .env -f infra/docker-compose.prod.yml)
PG=$("${COMPOSE[@]}" ps -q postgres)
U=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)

# 2. Остановить приложение, чтобы не писали в БД
"${COMPOSE[@]}" stop api worker

# 3. Снять текущее состояние на случай отката
docker exec "$PG" pg_dump -U "$U" -d staynest --format=custom -f /tmp/pre-restore.dump
docker cp "$PG:/tmp/pre-restore.dump" /home/deploy/backups/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).dump

# 4. Восстановить в новую базу и проверить счётчики
docker cp /home/deploy/restore.dump "$PG:/tmp/restore.dump"
docker exec "$PG" createdb -U "$U" staynest_restore
docker exec "$PG" pg_restore -U "$U" -d staynest_restore --no-owner --exit-on-error /tmp/restore.dump
docker exec "$PG" psql -U "$U" -d staynest_restore -tAc \
  "select (select count(*) from users), (select count(*) from listings), (select count(*) from bookings)"

# 5. Переключить базы (имена; соединений приложения уже нет)
docker exec "$PG" psql -U "$U" -d postgres -v ON_ERROR_STOP=1 \
  -c 'ALTER DATABASE staynest RENAME TO staynest_old' \
  -c 'ALTER DATABASE staynest_restore RENAME TO staynest'

# 6. Почистить временные plaintext-файлы и поднять приложение
docker exec "$PG" rm -f /tmp/restore.dump /tmp/pre-restore.dump
rm -f /home/deploy/restore.dump
"${COMPOSE[@]}" up -d api worker
```

Старая база `staynest_old` остаётся для отката; удалить её вручную после
проверки. Бакет: расшифровать `staynest-silo-<stamp>.tar.gz.age`, остановить
Silo (`"${COMPOSE[@]}" stop silo`), распаковать архив в том `staynest_silo-data`,
удалить plaintext-архив и поднять Silo. При восстановлении бакета и БД из
разных моментов времени возможны фото-сироты/битые ссылки — по возможности
берите бэкап БД и бакета одного stamp.


## 12. Мониторинг

- `GET /api/v1/health` возвращает `{"status":"ok","db":"up"}`; Caddy и API
  имеют Docker healthcheck. Docker перезапускает контейнер по exit-коду
  (`restart: unless-stopped`), а «unhealthy, но живой» контейнер ловит
  `staynest-health.timer`, а не Docker.
- `staynest-health.timer` каждые 5 минут запускает `scripts/prod-healthcheck.sh`:
  проверяет `/api/v1/health`, наличие всех шести контейнеров, занятость диска
  (порог 85%) и свежесть последнего зашифрованного бэкапа (порог 26 часов).
- Ошибки пишутся в journal (`journalctl -u staynest-health.service`) и, если в
  `/etc/staynest/health.env` задан `HEALTHCHECK_WEBHOOK_URL`, отправляются POST-ом
  с полем `text` (Slack-совместимый формат; для Discord нужен свой маппинг).
- Логи контейнеров ограничены `json-file` 10 МБ × 3 файла на сервис.
- Просмотр: `docker compose --env-file .env -f infra/docker-compose.prod.yml logs -f api worker caddy`.

## 13. CI/CD

`.github/workflows/deploy.yml` выкатывает стенд:

- по тегу `v*` (например, `git tag v0.17.0 && git push origin v0.17.0`);
- вручную через **Actions → Deploy → Run workflow** (можно указать ветку или тег).

Секреты репозитория: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`,
`DEPLOY_SSH_KEY` (отдельный ключ `staynest-ci`, добавленный в
`~deploy/.ssh/authorized_keys`), `DEPLOY_KNOWN_HOSTS` (публичный host key
сервера, снятый один раз с панели/по проверенному каналу, не `ssh-keyscan` в
раннере) и `DEPLOY_URL`. Workflow подключается по SSH со
`StrictHostKeyChecking=yes`, запускает `DEPLOY_REF=<ref> ./scripts/deploy.sh`,
который сначала делает свежий бэкап, и проверяет `/api/v1/health`.

Тег должен указывать на commit, у которого зелёный `ci.yml`; workflow деплоя
запускается параллельно CI и не ждёт его. Откат: если схема не менялась —
запустить workflow с предыдущим тегом/коммитом; если менялась — сначала
восстановить pre-deploy бэкап (раздел 11), потом выкатить старый код. Полный
rollback с миграциями не автоматизирован намеренно, чтобы не откатить данные.

`ci.yml` по-прежнему запускается на каждый push и PR: lint, types, tests,
сборка, gitleaks, audit.

## 14. Регистрация и демо-доступ на стенде

На стенде `REQUIRE_EMAIL_VERIFICATION=true`: после регистрации письмо со
ссылкой уходит в Mailpit, а вход до подтверждения возвращает
`403 email_not_verified`. Это ожидаемое поведение, а не ошибка.

Демо-аккаунты (созданы `pnpm seed:demo`, email уже подтверждён):

| Роль | Email | Пароль |
|---|---|---|
| Хозяин | `host@staynest.demo` | `StayNest-Demo-2026` |
| Гость | `guest@staynest.demo` | `StayNest-Demo-2026` |

Письма Mailpit доступны только через SSH-туннель:

```bash
ssh -N -L 8025:127.0.0.1:8025 staynest
# затем открыть http://localhost:8025
```

По SSH-туннелю также доступен Postgres для миграций и тестов:

```bash
ssh -N -L 5433:127.0.0.1:5433 staynest
```

Пароль `admin`/`admin` намеренно невозможен: политика требует минимум 10
символов и проверяет пароль по списку утечек. Для тестирования используйте
демо-аккаунты выше.

Депозит на стенде работает через мок-провайдера: хозяин подтверждает заявку,
гость нажимает «Оплатить депозит», попадает на отдельную страницу
`/api/v1/mock-payments/:token` и возвращается на бронь. Если
`PAYMENT_MOCK_ENABLED=true`, в `.env` обязателен `PAYMENT_WEBHOOK_SECRET`
(иначе API намеренно не стартует; секрет нужен в production всегда);
`PAYMENT_MOCK_ENABLED=false` отключает депозит целиком и не регистрирует
публичные маршруты мока. Реальные ключи ЮKassa/Stripe не нужны: это заглушка.
`deploy.sh` при отсутствии секрета генерирует случайную заглушку, чтобы мок
не ронял прод. Подробности — `docs/payments.md`.

Telegram Mini App на стенде выключен: `TELEGRAM_BOT_TOKEN` не задан, поэтому
`/api/v1/auth/telegram` отвечает `503`, вебхук не зарегистрирован. Это не ошибка
демо: основной канал — PWA. Как включить и что проверить с реальным ботом —
`docs/telegram.md`.

