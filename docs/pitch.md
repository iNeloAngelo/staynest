# Тексты о кейсе

Готовые формулировки для резюме, профилей и переписки. Факты — из
`docs/case-study.md`; цифры не выдумывать, при изменении проекта обновлять.

## 1. Резюме (3–5 строк)

> **Fullstack-разработчик (TypeScript / React / Node.js).** Портфолио-кейс
> StayNest: PWA для аренды домов с бронированием по календарю — живой стенд,
> 15 модулей API на Fastify + PostgreSQL, React-фронтенд, установка на телефон
> и офлайн-режим. Двойное бронирование исключено на уровне БД (exclusion
> constraint); тест на 50 параллельных заявок стабильно даёт ровно одну
> успешную. Каталог на 10 000 объявлений: p95 85 мс. Lighthouse на живом стенде:
> Performance 93, Accessibility 100.

## 2. Короткая версия (2–3 строки)

> StayNest — PWA для аренды домов: каталог с фильтром по свободным датам,
> бронирование с подтверждением, Web Push, офлайн-режим. Fastify + PostgreSQL
> + React, 101 ADR, тесты на конкурентность и IDOR, живой демо-стенд.

## 3. Telegram (для канала/чата, до 1000 знаков)

> Собрал портфолио-кейс StayNest — PWA для аренды домов.
>
> Что внутри:
> • каталог с поиском по свободным датам на 10 000 объявлений (p95 85 мс);
> • бронирование с подтверждением хозяином. Двойная бронь невозможна на уровне
>   PostgreSQL (exclusion constraint), тест: 50 параллельных заявок → ровно одна
>   успешная;
> • PWA: установка на телефон, офлайн-чтение избранного и поездок, Web Push;
> • платёжная заглушка с hosted-страницей и подписанным вебхуком;
> • 101 архитектурное решение, отчёты Lighthouse/ZAP, CI и деплой на VPS.
>
> Демо: https://olivertwist95.clodocd.com
> Код и разбор решений: https://github.com/iNeloAngelo/staynest
> Кейс: docs/case-study.md

## 4. LinkedIn / hh (абзац для описания проекта)

> **StayNest — PWA-сервис аренды домов (pet-проект).** Спроектировал и
> реализовал полный цикл: каталог с фильтрами и поиском по свободным датам,
> календарь доступности, движок бронирования с подтверждением, уведомления
> (in-app, SSE, Web Push), избранное, панель хозяина, платёжную заглушку и
> Telegram Mini App.
>
> Технологии: TypeScript strict, Fastify, zod, Kysely, PostgreSQL 16, pg-boss,
> React 19, TanStack Query, Tailwind, Workbox, Docker Compose, Caddy.
>
> Инженерные акценты: двойное бронирование исключено exclusion constraint в БД
> (тест 50×20 зелёный); идемпотентность заявок по `Idempotency-Key`;
> 11 обратимых миграций; IDOR-матрица на ключевые сценарии; каталог на
> 10 000 домов и 100 000 броней с p95 85 мс; Lighthouse A11y 100; gitleaks и
> `pnpm audit` в CI; бэкапы с проверенным восстановлением.
>
> Демо: https://olivertwist95.clodocd.com (аккаунты в README).

## 5. What to say in an interview (EN, short)

> I built StayNest, a house-rental PWA, end to end. The interesting part is the
> booking engine: overlapping bookings are impossible at the database level via
> a PostgreSQL exclusion constraint, and a 50-request concurrency test proves
> exactly one booking succeeds. The catalog stays at 85 ms p95 on 10k listings
> and 100k bookings. I also shipped the PWA side — installable, offline reads,
> web push — with automated tests for offline privacy.

## 6. Как отвечать на «а что было самым сложным»

Коротко: конкурентность и производительность поиска по датам. Подробно —
раздел 4 в `docs/case-study.md`; там же честный список ограничений
(SSE в памяти, непроверенный push на реальном iPhone, мок-платежи).
