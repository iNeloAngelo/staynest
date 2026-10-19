# Features (web)

Здесь живут законченные пользовательские блоки: `auth`, `catalog`, `listing-editor`,
`listing-details`, `photo-uploader`, `photo-gallery`, `price-editor`, `calendar`, `booking`,
`trips`, `host-requests`, `notifications`, `favorites`, `host-dashboard`, `profile`, `mode-switch`.

Шаблон фичи:

```
features/<name>/
├─ index.ts       публичный интерфейс фичи
├─ api/           запросы и хуки TanStack Query
├─ components/    компоненты
├─ model/         состояние и чистая логика
├─ README.md
└─ *.test.tsx
```

Правила: фича не импортирует внутренности другой фичи (только `index.ts`), не импортирует
`pages`, состояние сервера — только TanStack Query. Подробности — `docs/ARCHITECTURE.md`.
