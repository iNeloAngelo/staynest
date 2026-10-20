type PageState = 'payable' | 'processed' | 'unavailable';

export type PaymentPageInput = {
  state: PageState;
  title?: string;
  amountMinor?: number;
  currency?: string;
  checkIn?: string | null;
  checkOut?: string | null;
  dueAt?: Date | null;
  timeZone?: string;
  bookingUrl?: string;
  message?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amountMinor / 100);
  } catch {
    return `${(amountMinor / 100).toFixed(0)} ${currency}`;
  }
}

function day(value: string | null | undefined, timeZone?: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timeZone ?? 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
}

function deadline(value: Date | null | undefined, timeZone?: string): string {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timeZone ?? 'UTC',
  }).format(value);
}

const STYLES = `
  :root { color-scheme: light; --bg:#FAF7F2; --surface:#fff; --ink:#24211D; --muted:#6B645A; --primary:#2F6B4F; --primary-hover:#255640; --border:#E2DCD2; --danger:#B23A2E; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px 16px; background:var(--bg); color:var(--ink); font-family: "Segoe UI", system-ui, -apple-system, sans-serif; }
  main { width:100%; max-width:420px; background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:24px; box-shadow:0 8px 24px rgb(36 33 29 / 8%); }
  .brand { margin:0 0 4px; font-size:13px; font-weight:700; letter-spacing:.14em; text-transform:uppercase; color:var(--primary); }
  h1 { margin:0 0 8px; font-size:24px; line-height:1.25; }
  p { margin:0 0 16px; color:var(--muted); font-size:15px; line-height:1.5; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:8px 16px; margin:0 0 20px; font-size:15px; }
  dt { color:var(--muted); }
  dd { margin:0; text-align:right; font-weight:600; }
  .amount { font-size:28px; font-weight:700; margin:0 0 20px; }
  .actions { display:flex; flex-direction:column; gap:8px; }
  button, a.button { display:inline-flex; align-items:center; justify-content:center; min-height:48px; padding:0 18px; border-radius:10px; border:1px solid transparent; font-size:16px; font-weight:600; text-decoration:none; cursor:pointer; }
  button.primary { background:var(--primary); color:#fff; }
  button.primary:hover { background:var(--primary-hover); }
  button.secondary { background:transparent; color:var(--ink); border-color:var(--border); }
  a.button { background:var(--primary); color:#fff; }
  :focus-visible { outline:3px solid var(--primary); outline-offset:2px; }
  .note { margin-top:16px; font-size:13px; color:var(--muted); }
`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>${escapeHtml(title)} — StayNest</title>
  <style>${STYLES}</style>
</head>
<body>
  <main>
    <p class="brand">StayNest · демо-оплата</p>
    ${body}
  </main>
</body>
</html>`;
}

function unavailableBody(input: PaymentPageInput): string {
  const message = input.message ?? 'Ссылка устарела или платёж уже обработан.';
  return `<h1>Платёж недоступен</h1>
    <p>${escapeHtml(message)}</p>
    ${input.bookingUrl ? `<a class="button" href="${escapeHtml(input.bookingUrl)}">Вернуться к брони</a>` : ''}`;
}

function processedBody(input: PaymentPageInput): string {
  const message = input.message ?? 'Повторная оплата не нужна.';
  return `<h1>Платёж уже обработан</h1>
    <p>${escapeHtml(message)}</p>
    ${input.bookingUrl ? `<a class="button" href="${escapeHtml(input.bookingUrl)}">Вернуться к брони</a>` : ''}`;
}

function payableBody(input: PaymentPageInput): string {
  const amount = money(input.amountMinor ?? 0, input.currency ?? 'RUB');
  const dates =
    input.checkIn && input.checkOut
      ? `<dt>Даты</dt><dd>${escapeHtml(day(input.checkIn, input.timeZone))} — ${escapeHtml(day(input.checkOut, input.timeZone))}</dd>`
      : '';
  const due = input.dueAt
    ? `<dt>Оплатить до</dt><dd>${escapeHtml(deadline(input.dueAt, input.timeZone))}</dd>`
    : '';

  return `<h1>${escapeHtml(input.title ?? 'Бронирование')}</h1>
    <p>Депозит подтверждает бронь. Это демонстрационная страница: данные карты не запрашиваются и не сохраняются.</p>
    <p class="amount">${escapeHtml(amount)}</p>
    <dl>${dates}${due}</dl>
    <form class="actions" method="post">
      <button class="primary" type="submit" name="result" value="pay">Оплатить депозит</button>
      <button class="secondary" type="submit" name="result" value="fail">Отказаться</button>
    </form>
    <p class="note">Мок-провайдер: реальные деньги не списываются. Возврат выполняется автоматически при отмене брони.</p>`;
}

export function paymentPage(input: PaymentPageInput): string {
  if (input.state === 'unavailable') return layout('Платёж недоступен', unavailableBody(input));
  if (input.state === 'processed') return layout('Платёж обработан', processedBody(input));
  return layout('Депозит', payableBody(input));
}
