# Модуль seo

## Зачем

Отдаёт машиночитаемые ответы, которые SPA не может дать без исполнения JavaScript:
`robots.txt`, `sitemap.xml` и минимальный HTML карточки/главной с Open Graph и
JSON-LD. Обычные посетители получают React-приложение от Caddy; сюда приходят
только краулеры (матчер `User-Agent` в `infra/Caddyfile`).

## Публичный API

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/robots.txt` | правила обхода и абсолютная ссылка на sitemap |
| `GET` | `/sitemap.xml` | главная и опубликованные дома, `lastmod` из `published_at` |
| `GET` | `/` | HTML главной для роботов: OG-теги и ссылки на 12 свежих домов |
| `GET` | `/listings/:id` | HTML карточки: title, description, canonical, OG, JSON-LD `LodgingBusiness` |

Данные берутся через публичный `createCatalogService` (ADR-017): модуль не
делает SQL к `listings` и не может вернуть черновик или архив. Ответы
кэшируются на 10 минут с `stale-while-revalidate`.

## Ограничения

- `sitemap.xml` ограничен 50 000 URL; при росте каталога нужен sitemap-index
  (Backlog).
- HTML для роботов — не полноценная страница: без навигации и интерактивных
  элементов. Он существует для индексации и превью в мессенджерах, а не для
  людей.
- Список краулеров задан в Caddy, а не в приложении. Новый бот нужно добавлять
  осознанно, иначе он получит SPA.

## Как тестировать

`apps/api/tests/seo.test.ts`: robots, sitemap (только published), HTML главной,
Open Graph, JSON-LD, 404 на черновик и битый id.
