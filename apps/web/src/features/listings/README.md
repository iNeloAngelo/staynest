# Фича listings (web)

## Зачем

Экран «Мои объявления» и API-обвязка объявлений: список со статусами, создание
пустого черновика, публикация, архив и удаление. Мастер правки живёт в отдельной
фиче `listing-editor` (Сессия 7) и использует публичные хуки и компоненты этой
фичи, чтобы не дублировать запросы и отображение статусов.

## Структура

```
features/listings/
├─ api/listings.ts        запросы к /me/listings, /listings, /listings/:id/amenities
├─ api/hooks.ts           TanStack Query и инвалидация списка
├─ components/            карточка, статус, сводка ошибок
├─ model/errors.ts        коды problem+json → i18n-ключи и якоря полей
└─ index.ts               публичный интерфейс
```

## Публичный интерфейс

- `useMyListings`, `useCreateListing` — список и создание черновика;
- `useUpdateListing`, `useReplaceAmenities`, `usePublishListing`,
  `useArchiveListing`, `useDeleteListing`, `useAmenities` — операции, которые
  переиспользует мастер;
- `MyListingCard` — карточка в списке;
- `ListingStatusBadge`, `ListingIssuesAlert` — статус и ошибки полей;
- `listingsErrorKey`, `issueTextKey`, `publishIssuesFrom`, `fieldAnchor` —
  перевод ошибок и переходы к полям.

## Состояния

Список: скелетоны, пусто, ошибка с повтором, офлайн-предупреждение, кнопка
«Создать». Публикация и архив показывают ошибки списком; `ListingIssuesAlert`
фокусируется один раз при появлении ошибок и не перехватывает фокус, пока
пользователь исправляет поля.

## Тестирование

```bash
pnpm --filter @staynest/web test
```

`app/App.test.tsx` проверяет список, создание черновика и публикацию;
`features/listing-editor` содержит тесты мастера и модели формы.
