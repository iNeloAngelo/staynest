# Feature host-calendar

Экран `/host/calendar`: календарь занятости, блокировки, базовые/выходные цены
и сезонные правила выбранного объявления.

- `api/` — host-календарь, блокировки и price-rules; мутации инвалидируют
  `host-calendar` и гостевые `booking`-запросы.
- `model/calendar.ts` — границы месяца, множество занятых ночей (бронь `[from,to)`,
  блокировка включительно), модификаторы DayPicker.
- `components/HostMonthCalendar.tsx` — цвета: заявка (warning), подтверждено
  (success), блокировка (ink-muted), клавиатура и aria-label статусов.
- `components/BlockDialog.tsx` — блокировка выбранного диапазона; в API уходит
  последняя ночь включительно.
- `components/PricesForm.tsx` — базовая цена, выходные, уборка.
- `components/PriceRulesPanel.tsx` — CRUD сезонных правил, приоритет и min nights.
