# Pages (web)

Тонкие экраны уровня маршрута: `home`, `login`, `register`, `verify-email`,
`forgot-password`, `reset-password`, `profile`, `trips`, `favorites`,
`host-dashboard`, `host-listings`, `host-requests`, `host-calendar`, `not-found`.
Страница собирает фичи и не содержит запросов и бизнес-правил; исключение —
dev-витрина `/dev/ui`, которая доступна только при `import.meta.env.DEV` и не
попадает в prod-бандл.

Все экраны Сессий 4–14 реализованы; общий плейсхолдер больше не используется.
