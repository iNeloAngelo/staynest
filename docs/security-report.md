# Отчёт по безопасности: ZAP baseline и OWASP Top 10

Дата скана: 2026-10-20. Цель: живой стенд https://olivertwist95.clodocd.com.
Инцидентов нет; критичных (High) находок нет.

## 1. Как проводился скан

```bash
docker run --rm -v "$PWD/tmp/reports:/zap/wrk:rw" zaproxy/zap-stable \
  zap-baseline.py -t https://olivertwist95.clodocd.com \
  -r zap-baseline.html -J zap-baseline.json -w zap-baseline.md -I
```

ZAP 2.x (образ `zaproxy/zap-stable`), пассивный скан + стандартный spider:
48 URL, 40 endpoint'ов, только `GET` (baseline не логинится и не меняет данные).
Полные отчёты: `tmp/reports/zap-baseline.{html,json,md}` (каталог `tmp/` в git не
попадает; сводка ниже — то, что нужно сохранить).

## 2. Результат

| Уровень | Количество | Что это |
|---|---:|---|
| High | **0** | — |
| Medium | 2 | `form-action` не задан; `style-src 'unsafe-inline'` |
| Low | 2 | нет `Cross-Origin-Embedder-Policy`; нет `Cross-Origin-Resource-Policy` |
| Informational | 5 | cache-control, «modern web application», комментарии в бандле |
| PASS | 61 правил | в т.ч. HSTS, CSP присутствует, cookie HttpOnly/Secure/SameSite, нет утечки версий, нет clickjacking |

### 2.1. Medium: `form-action` не задан (исправлено в коде)

ZAP: *«The directive(s): form-action is/are among the directives that do not
fallback to default-src»*.

`form-action` действительно не наследуется от `default-src`: без него форма на
странице может отправить данные на чужой домен. Исправлено:

- `infra/Caddyfile` — в CSP добавлено `form-action 'self'`;
- `apps/api/src/app.ts` (helmet) — `formAction: ["'self'"]`.

На стенде изменение появится после ближайшего деплоя; до этого риск низкий:
все формы приложения отправляются на свой origin, пользовательский HTML не
рендерится (`dangerouslySetInnerHTML` запрещён линтом).

### 2.2. Medium: `style-src 'unsafe-inline'` (принятый риск)

Нужен для инлайновых стилей React (атрибут `style`, тема, safe-area) и
`style`-атрибутов сторонних компонентов. Скрипты по-прежнему только `'self'`,
`script-src 'unsafe-inline'` отсутствует, поэтому главный вектор XSS — внедрение
скрипта — закрыт. Отказ от `unsafe-inline` требует nonce/hash для каждого
инлайнового стиля и ломает часть UI; для MVP это дороже, чем риск инъекции
только CSS.

### 2.3. Low: `Cross-Origin-Embedder-Policy` (принятый риск)

`require-corp` включён не будет: Telegram Web открывает Mini App в iframe, а
COEP требует CORP от всех вложенных ресурсов и ломает официальный SDK. Плюс
COEP нужен для `SharedArrayBuffer`/`performance.measureUserAgentSpecificMemory`,
которых в проекте нет. Риск Spectre-класса для этого приложения низкий.

### 2.4. Low: `Cross-Origin-Resource-Policy` (исправлено в коде)

Добавлено `Cross-Origin-Resource-Policy: same-origin` в заголовки Caddy для
HTML/статики. API уже отдавал CORP через helmet. Медиа проксируются с того же
origin, поэтому поведение не меняется.

### 2.5. Informational

- **Cache-control.** `index.html` и `manifest` — `no-cache` (иначе PWA не увидит
  обновление), `robots.txt`/`sitemap.xml` — `public, max-age=600`. Это
  намеренно; персональные ответы `/me/*` отдают `private, no-store` (см. §2.5).
- **Комментарии в бандле.** Ложное срабатывание: ZAP ищет слово `query` в
  минифицированном коде (`useOnline-*.js`) и в официальном
  `telegram-web-app.js`. Секретов и путей сервера там нет.
- **«Modern Web Application».** SPA без ссылок в HTML — ожидаемо; для краулеров
  есть отдельный HTML и `sitemap.xml`.
- **Storable content.** Публичные статические ресурсы кэшируются осознанно
  (`immutable` для `/assets/*`).

## 3. Ручная проверка OWASP Top 10 (2021)

| Категория | Что проверено | Статус |
|---|---|---|
| **A01 Broken Access Control** | Матрица IDOR: 8 сценариев (чужое объявление, чужие фото, чужие брони, действия confirm/decline/cancel, `/me/listings`, избранное, платежи). Чужой ресурс отвечает `404`, а не `403` (ADR-043). Матрица — `apps/api/tests/security/idor.test.ts`, в CI | ✅ |
| **A02 Cryptographic Failures** | argon2id для паролей (параметры через env), refresh-токен — opaque + хэш в БД, access — JWT 15 мин, httpOnly/Secure/SameSite cookie, HSTS, HTTPS-only. Секретов в git нет (gitleaks) | ✅ |
| **A03 Injection** | Все запросы — параметризованный Kysely; сортировка по whitelist; `q` через `websearch_to_tsquery`; загрузки перекодируются sharp; React экранирует текст, `dangerouslySetInnerHTML` запрещён. Тесты на payload'ы и поддельные файлы | ✅ |
| **A04 Insecure Design** | Двойная бронь исключена constraint'ом; цена считается только на сервере; лимит 5 активных заявок; идемпотентность; TTL заявки и депозита | ✅ |
| **A05 Security Misconfiguration** | Helmet, CSP, лимит тела, CORS/Owner-guard, `X-Powered-By` убран, порты Postgres/Silo/Mailpit закрыты наружу, контейнеры без лишних capabilities. ZAP: 0 High | ✅ |
| **A06 Vulnerable Components** | `pnpm audit --audit-level high` в CI; lockfile; разрешённый риск по dev-инструменту зафиксирован в ADR-030 | ✅ |
| **A07 Identification/Auth Failures** | Ротация refresh с отзывом цепочки, rate limit + прогрессивная задержка, единые ответы против перечисления, проверка по списку утёкших паролей, подтверждение email, сброс пароля одноразовым токеном, смена пароля завершает сессии | ✅ |
| **A08 Software/Data Integrity** | Подпись вебхука HMAC по сырому телу, проверка `initData` Telegram, `Idempotency-Key`, CI собирает и тестирует образ, деплой по тегу с known_hosts | ✅ |
| **A09 Logging/Monitoring** | pino + request-id, без паролей/токенов/полных email; журнал неудачных входов; healthcheck и алерт; бэкапы с restore-check. Внешний аптайм-монитор — Backlog | ⚠️ частично |
| **A10 SSRF** | Сервер не ходит по пользовательским URL; push-endpoint валидируется по allowlist хостов. Если появятся импорты по ссылке — нужен whitelist | ✅ |

## 4. Секреты в истории git

```bash
docker run --rm -v "$PWD:/repo" zricethezav/gitleaks:latest \
  detect --source=/repo --config=/repo/.gitleaks.toml
# 100 коммитов, ~3.4 МБ → no leaks found
```

До добавления allowlist было 5 находок, все — синтетические значения в тестах:
`StrongPass-2026` (`packages/shared/src/auth.test.ts`), `Mountain-River-2027`
(`apps/api/src/modules/auth/routes.test.ts`), e2e-`JWT_SECRET`
(`playwright.config.ts`). Эти значения не используются ни в одном окружении;
пути разрешены точечно в `.gitleaks.toml` (ADR-101). `.env` в историю не
попадал: файл в `.gitignore` с первого коммита.

## 5. Что осталось

- Задеплоить исправления CSP/CORP и повторить скан — тогда Medium/Low по
  заголовкам уйдут (кроме осознанных `style-src` и COEP).
- Аутентифицированный скан ZAP (с демо-аккаунтом) не проводился: baseline
  проверяет только публичную часть. Для более глубокого теста — ZAP с
  контекстом логина или ручные сценарии из матрицы IDOR (уже покрыты тестами).
- Внешний аптайм-монитор (см. `docs/TODO.md`, Backlog С17).
