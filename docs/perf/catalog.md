# Lighthouse: каталог и карточка дома (Сессия 8)

Дата: 2026-10-19. Инструмент: `lighthouse@12.8.2`, Edge в режиме `--headless=new`,
мобильный профиль по умолчанию, dev-сборка Vite на `http://127.0.0.1:5173`.

| Страница | URL | Accessibility |
|---|---|---|
| Каталог | `/` | **100** |
| Карточка дома | `/listings/059f8c9d-df62-40a3-a686-74df016da781` | **100** |

Проверялись только категории доступности (DoD Сессии 8: A11y ≥ 90). Полный
отчёт Performance/Best Practices/SEO и прод-сборка — Сессия 15.

Команда:

```bash
pnpm dlx lighthouse@12.8.2 http://127.0.0.1:5173/ \
  --only-categories=accessibility \
  --chrome-path="C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" \
  --chrome-flags="--headless=new --no-sandbox"
```

Найденное и исправленное по ходу: кнопка переключения языка имела `aria-label`
без видимого текста «RU» (`label-content-name-mismatch`). Теперь доступное имя
включает текущую локаль.

Поиск по свободным датам и планы запросов на перф-данных — `docs/perf/search.md`
(Сессия 10).
