# Lighthouse: PWA после Сессии 15

Дата: 2026-10-20. Сборка: `pnpm --filter @staynest/web build`, production-режим
(mode `production`, dev/ui и `/push-sw.js` в клиентский бандл не попадают).

## Как измерялось

Lighthouse 12.8.2, мобильный профиль (Moto G Power, 4× CPU, 1.6 Мбит/с,
RTT 150 мс), Edge headless:

```powershell
pnpm dlx lighthouse@12.8.2 "http://127.0.0.1:4180/" `
  --chrome-path="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --chrome-flags="--headless=new --no-sandbox" `
  --output=json --output-path=lighthouse.json --max-wait-for-load=60000 --quiet
```

`vite preview` не сжимает ответы, поэтому для замера использован локальный
статический сервер с gzip и прокси `/api`, `/media` (аналог Caddy). В проде
Caddy отдаёт zstd/gzip по HTTP/2 — это не хуже локального замера.

Первый запуск после сборки может быть медленнее: service worker ставится
после `load` и в `requestIdleCallback`, чтобы precache оболочки не конкурировал
с первым рендером. Ниже — два последовательных прогона.

## Результаты

| Категория | Порог DoD | Прогон 1 | Прогон 2 |
|---|---:|---:|---:|
| Performance | ≥ 85 | **86** | **87** |
| Accessibility | ≥ 95 | **100** | **100** |
| Best Practices | ≥ 95 | **96** | **96** |
| SEO | ≥ 90 | **92** | **92** |

Метрики (прогон 1): FCP 2.9 с, LCP 3.2 с, TBT 150 мс, CLS 0.001,
Speed Index 2.9 с. Прогон 2: FCP 2.9 с, LCP 3.2 с, TBT 120 мс, CLS 0.002.

LCP-элемент — `h1` «Дом, который ждёт вас». TTFB ~0.46 с, остальное —
render delay из-за разбора стартового JS. Это ожидаемо для SPA; карточки и
фото догружаются после первого экрана.

## Что улучшено по сравнению с первым замером

Первый прогон дал Performance 79–81 при FCP 3.4 с и LCP 4.1 с. Причины и правки:

1. **Production-сборка собиралась как dev.** `loadEnv(..., '')` в
   `apps/web/vite.config.ts` читал `NODE_ENV=development` из корневого `.env`
   и выставлял `VITE_USER_NODE_ENV`. Vite считал сборку не-production:
   в бандл попадали `/dev/ui`, `DevUiPage` и dev-путь `/push-sw.js`.
   Теперь `NODE_ENV`/`VITE_USER_NODE_ENV` восстанавливаются после `loadEnv`.
2. **Главная тянула код бронирования и календаря через barrel-экспорт.**
   `HomePage` импортировал `CatalogView` из `features/catalog/index.ts`,
   который реэкспортировал `ListingDetails` → `BookingPanel` →
   `react-day-picker` (83 КБ JS). Импорт заменён на прямой путь к
   `CatalogView`; главная больше не грузит `calendarStyles` и `booking`.
3. **Ленивые маршруты.** Все экраны, кроме главной и 404/офлайн, вынесены
   в `app/lazyPages.ts`: профиль, поездки, бронь, избранное, хост-разделы,
   вход/регистрация. Стартовый чанк не содержит редактор объявления,
   календарь, панель хозяина и формы.
4. **Английский словарь грузится по требованию** (`en` — отдельный чанк
   11.7 КБ gzip). Русский остаётся в стартовом чанке как язык по умолчанию.
5. **Главная сделана eager-маршрутом.** H1 рисуется сразу после основного
   чанка, без дополнительной цепочки `HomePage → CatalogView → ...`:
   LCP 4.1 → 3.2 с.
6. **Service worker не мешает первому рендеру.** Регистрация отложена до
   `load` + `requestIdleCallback`; precache 1.5 МБ не отбирает полосу у
   критических запросов.

## Живой стенд (2026-10-20)

Тот же Lighthouse 12.8.2, мобильный профиль, Edge headless, но цель —
продакшен-стенд по HTTPS через Caddy (HTTP/2 + zstd/gzip). Один прогон:

```powershell
pnpm dlx lighthouse@12.8.2 "https://olivertwist95.clodocd.com/" `
  --chrome-path="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" `
  --chrome-flags="--headless=new --no-sandbox" `
  --output=json --output-path=tmp/reports/lighthouse-live.json --quiet
```

| Категория | Порог DoD | Живой стенд |
|---|---:|---:|
| Performance | ≥ 85 | **93** |
| Accessibility | ≥ 95 | **100** |
| Best Practices | ≥ 95 | **93** |
| SEO | ≥ 90 | **100** |

Метрики: FCP 2.2 с, LCP 2.9 с, TBT 80 мс, CLS 0, Speed Index 2.2 с.
LCP-элемент — `h1` «Дом, который ждёт вас».

Почему не 100:

- **`errors-in-console`** — анонимный `GET /me` получает 401, затем refresh 403.
  Это ожидаемый контракт сессии; ошибка видна только в консоли.
- **`inspector-issues`** — предупреждения браузера по CSP/ресурсам.
- **`unminified-javascript`** — официальный `telegram-web-app.js` лежит локально
  как есть (минифицировать чужой SDK без нужды не будем).
- **`render-blocking` / `image-delivery`** — стартовый CSS/JS и фото карточек;
  дальше дробить vendor-чанки смысла мало (см. ниже).
- **`unused-javascript`** — главная грузит код каталога и карточек; остальные
  экраны уже ленивые.

## Замечания аудита, которые остались

- `errors-in-console`: анонимный `GET /me` получает 401, затем refresh — 403.
  Это ожидаемый контракт; консольные ошибки не влияют на функциональность,
  но стоят 4 балла Best Practices.
- `robots.txt` и `sitemap.xml` появились в Сессии 16 и отдаются API через Caddy;
  в локальном замере Сессии 15 их ещё не было.
- TBT 150–180 мс в локальном замере даёт разбор стартового чанка React + router +
  TanStack Query. На живом стенде с HTTP/2 и zstd TBT — 80 мс, так что дальше
  дробить vendor-код не требуется.
- Lighthouse не проверяет установку на реальном Android/iOS. Это ручной
  чек-лист DoD; PWA-поведение (SW, офлайн, очистка кэшей) автоматизировано
  в `pnpm e2e:pwa`.
