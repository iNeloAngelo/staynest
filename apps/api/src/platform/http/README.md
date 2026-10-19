# HTTP-слой API

## Формат ошибок

Все ошибки отдаются как `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Conflict",
  "status": 409,
  "detail": "Эти даты уже заняты.",
  "code": "booking_dates_unavailable"
}
```

- `code` — машиночитаемый код для клиента (`booking_dates_unavailable`, `not_found`…).
- `detail` — безопасный текст для пользователя. Сообщение исходного `Error` наружу не уходит.
- 5xx всегда `internal_error` и generic-текст; подробности пишутся в лог (без DSN, SQL и PII).

## Как бросать доменные ошибки

```ts
throw new AppError({
  status: 409,
  code: 'booking_dates_unavailable',
  title: 'Conflict',
  detail: 'Эти даты только что заняли. Выберите другие.',
});
```

Для неизвестных 4xx Fastify (`FST_ERR_*`) обработчик сам подставляет безопасный `code` и `detail`
по статусу. Валидационные ошибки попадают в поле `errors`.

## Важно: обработчики живут на корневом инстансе

`setErrorHandler` и `setNotFoundHandler` вызываются в `app.ts` на корневом Fastify-инстансе.
Внутри плагина они были бы инкапсулированы и не применялись к маршрутам соседних модулей.
Регрессионные тесты: `apps/api/src/modules/health/routes.test.ts` (500 без утечки, 400 на битый
JSON, 413, 404, доменный `AppError`).
