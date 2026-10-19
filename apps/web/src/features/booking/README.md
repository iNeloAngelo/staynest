# Feature booking (гость)

Календарь доступности и расчёт стоимости на карточке дома.

- `api/` — `/calendar` и `/quote`, TanStack Query.
- `model/selection.ts` — чистая логика выбора диапазона: занятую ночь нельзя
  перепрыгнуть, выезд в день занятой ночи разрешён, min/max nights проверяются
  до запроса quote.
- `components/BookingCalendar.tsx` — react-day-picker с локалями ru/en,
  aria-label «дата, статус», занятые ночи зачёркнуты.
- `components/BookingPanel.tsx` — диапазон, гости, серверный расчёт и CTA.
  На мобильном открывается в BottomSheet из липкой панели цены.

Сумма всегда берётся из ответа `/quote`; клиент не складывает цены сам.
