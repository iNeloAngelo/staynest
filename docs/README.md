# Документация StayNest

Индекс документов. Читать в этом порядке, если нужен контекст проекта.

## Продукт и правила

| Файл | Зачем |
|---|---|
| [`../CONSTITUTION.md`](../CONSTITUTION.md) | Непреложные принципы: корректность брони, деньги, секреты, права |
| [`../AGENTS.md`](../AGENTS.md) | Правила работы агента и протокол сессии |
| [`TZ.md`](TZ.md) | Техническое задание: функции, API, нефункциональные требования |
| [`SESSIONS.md`](SESSIONS.md) | План из 20 сессий и Definition of Done каждой |
| [`DESIGN.md`](DESIGN.md) | Дизайн-система: токены, компоненты, состояния, чек-лист ревью |
| [`ESTIMATE.md`](ESTIMATE.md) | Оценка по времени и деньгам |

## Инженерия

| Файл | Зачем |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Границы модулей, правила зависимостей, граф |
| [`DB.md`](DB.md) | Схема БД, миграции, ER-диаграмма, ключевые запросы |
| [`booking-engine.md`](booking-engine.md) | Транзакция брони, идемпотентность, статусы, pg-boss |
| [`DECISIONS.md`](DECISIONS.md) | ADR: что выбрано и почему (101 решение) |
| [`SECURITY.md`](SECURITY.md) | Модель угроз и защита по слоям |
| [`security-report.md`](security-report.md) | Результаты ZAP baseline и чек-лист OWASP Top 10 |
| [`ops.md`](ops.md) | Сервер, деплой, бэкапы, восстановление, инциденты |
| [`payments.md`](payments.md) | Мок-провайдер и замена на ЮKassa/Stripe |
| [`telegram.md`](telegram.md) | Telegram Mini App: вход, бот, ограничения |

## Отчёты

| Файл | Зачем |
|---|---|
| [`perf/search.md`](perf/search.md) | EXPLAIN, индексы и p50/p95 каталога на 10k/100k |
| [`perf/concurrency.md`](perf/concurrency.md) | Тест 50 параллельных заявок на одни даты |
| [`perf/lighthouse.md`](perf/lighthouse.md) | Lighthouse: локальная сборка и живой стенд |
| [`perf/coverage.md`](perf/coverage.md) | Покрытие тестами API и web |
| [`perf/catalog.md`](perf/catalog.md) | Замеры каталога до/после оптимизаций |
| [`architecture/deps.svg`](architecture/deps.svg) | Полный граф зависимостей (dependency-cruiser) |
| [`screens/`](screens/) | Скриншоты экранов 360/768/1280, светлая и тёмная тема |

## Кейс и материалы

| Файл | Зачем |
|---|---|
| [`case-study.md`](case-study.md) | Разбор кейса: задача, решения, сложности, результаты |
| [`pitch.md`](pitch.md) | Тексты для резюме, Telegram, LinkedIn/hh |
| [`demo.md`](demo.md) | Сценарий демо, запись видео, установка PWA |
| [`credits.md`](credits.md) | Источники и лицензии демо-фотографий (CC0) |
| [`LEARNS.md`](LEARNS.md) | Журнал граблей и найденных решений |
| [`TODO.md`](TODO.md) | Чек-лист сессий и Backlog |
| [`SKILLS-AND-AGENTS.md`](SKILLS-AND-AGENTS.md) | Навыки, MCP-серверы и таблица ревьюеров по сессиям |

Конфигурация агентов и навыков (`.opencode/`) не хранится в репозитории:
правила проекта — в `AGENTS.md` и `CONSTITUTION.md`, роли ревьюеров описаны в
`SKILLS-AND-AGENTS.md`.
