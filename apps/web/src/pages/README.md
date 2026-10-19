# Pages (web)

Тонкие экраны уровня маршрута: `home`, `login`, `register`, `verify-email`,
`forgot-password`, `reset-password`, `profile`, `trips`, `favorites`,
`host-listings`, `host-requests`, `host-calendar`, `not-found`. Страница собирает
фичи и не содержит запросов и бизнес-правил; исключение — dev-витрина `/dev/ui`,
которая доступна только при `import.meta.env.DEV` и не попадает в prod-бандл.

Плейсхолдеры будущих разделов (`trips`, `favorites`, `host-*`) используют общий
`PlaceholderPage` и будут заменены в Сессиях 5–14.
