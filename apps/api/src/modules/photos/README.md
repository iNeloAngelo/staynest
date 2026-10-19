# Модуль photos (API)

## Зачем

Приём фотографий объявления, их безопасная переработка и раздача. Модуль
владеет таблицей `listing_photos` и объектами в S3-совместимом хранилище.

## Публичный интерфейс

`index.ts` экспортирует только `photosRoutes`. Владение объявлением проверяется
через `requireOwnedListing` из публичного интерфейса модуля `listings`.

## Маршруты

| Метод | Путь | Что делает |
|---|---|---|
| `POST` | `/listings/:id/photos` | multipart, поле `files`, до 10 файлов за запрос |
| `PATCH` | `/listings/:id/photos/order` | `{ photoIds: string[] }` — полный новый порядок |
| `PATCH` | `/listings/:id/photos/:photoId/cover` | делает фото обложкой |
| `DELETE` | `/listings/:id/photos/:photoId` | удаляет строку и три объекта из хранилища |

Ответы upload/order/cover — `{ photos: ListingPhotoDto[] }`, `DELETE` — `204`.

## Конвейер обработки

1. `file-type` определяет формат по сигнатуре: JPEG, PNG, WebP, AVIF.
   Расширение файла и заголовок `Content-Type` не доверяются.
2. `sharp` с `limitInputPixels` (32 Мп по умолчанию, верхняя граница 40 Мп)
   защищает от decompression bomb; ошибки декодирования дают `415`.
3. `rotate()` применяет EXIF orientation, затем изображение декодируется в
   сырые пиксели. Все варианты собираются из сырых пикселей, поэтому EXIF
   (включая GPS), ICC и прочие метаданные в файлы не попадают.
4. Три WebP-варианта: `thumb.webp` 400 px, `md.webp` 1000 px,
   `lg.webp` 2000 px по длинной стороне, без апскейла.
5. `blurhash` 4×3 для плейсхолдера; его отсутствие не ломает загрузку.
6. Ключи: `listings/{listingId}/{photoId}/{variant}.webp`.
   В БД хранится только префикс `listings/{listingId}/{photoId}`.

## Транзакции и лимиты

- Файлы читаются потоком и обрабатываются по одному. Слот семафора берётся до
  `toBuffer()`, поэтому ожидающие запросы не держат буферы; внутри слота файл
  декодируется, варианты сразу уходят в S3, в памяти остаются только метаданные.
  Затем короткая транзакция блокирует строку объявления (`FOR UPDATE`), проверяет
  потолок фото, считает позиции и вставляет строки. Если лимит превышен или
  объявление исчезло, загруженные объекты удаляются.
- Семафор ограничивает два одновременных вызова `sharp` в процессе, а загрузки
  одного пользователя — 30 запросов за 10 минут (`429`, `Retry-After`).
- Первое фото становится обложкой; `listings.cover_photo_id` обновляется в той
  же транзакции.
- Порядок меняется в транзакции; `listing_photos_position_uq` объявлен
  `DEFERRABLE INITIALLY DEFERRED`, поэтому промежуточные конфликты безопасны.
- При удалении обложки следующее по порядку фото становится обложкой. У
  опубликованного объявления нельзя оставить меньше трёх фото —
  `422 photos_too_few_published`, удаление откатывается.
- Возможные ошибки: `photo_unsupported_type` (415), `photo_too_large` (413),
  `photo_pixels_exceeded` (422), `photos_limit_reached` (422),
  `photos_per_upload_limit` (422), `photo_order_invalid` (422),
  `photos_too_few_published` (422), `photo_not_found` (404),
  `listing_not_found` (404), `photo_upload_rate_limited` (429),
  `storage_unavailable` (503).

## Хранилище

`platform/storage` создаёт бакет при первом обращении и ставит публичную
политику только на `listings/*/*/*.webp`; остальные объекты бакета анонимно
недоступны. Раздача идёт через Caddy (`/media/listings/*` → Silo, только
`GET`/`HEAD`), с `nosniff` и immutable-кэшем. В dev тот же путь проксирует Vite.

## Тесты

- `image.test.ts` — варианты, поворот по EXIF, удаление метаданных, exe под
  видом jpg, битый PNG, `limitInputPixels`.
- `tests/photos.test.ts` — загрузка, отказы 413/415, лимит объявления с
  очисткой хранилища, порядок, обложка, удаление файлов, IDOR, 401.

```bash
pnpm --filter @staynest/api exec vitest run src/modules/photos tests/photos.test.ts
```
