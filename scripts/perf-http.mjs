/**
 * End-to-end замер `GET /listings` на перф-данных (Сессия 10).
 * API должен быть запущен:
 *
 *   pnpm --filter @staynest/api dev
 *   pnpm perf:http
 *
 * Адрес можно переопределить: `API_URL=http://127.0.0.1:3100 pnpm perf:http`.
 */

const base = (process.env.API_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
const repeatArg = process.argv.find((value) => value.startsWith('--repeat='));
const repeat = repeatArg ? Number(repeatArg.slice('--repeat='.length)) : 30;

function isoInDays(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const checkIn = isoInDays(30);
const checkOut = isoInDays(37);
const blockIn = isoInDays(16);
const blockOut = isoInDays(23);
const dates = `check_in=${checkIn}&check_out=${checkOut}`;

const SCENARIOS = [
  { name: 'без дат', query: '' },
  { name: 'свободные даты', query: dates },
  { name: 'q + даты', query: `${dates}&q=${encodeURIComponent('озеро')}` },
  {
    name: 'price_asc + город + даты',
    query: `${dates}&city=${encodeURIComponent('Суздаль')}&sort=price_asc`,
  },
  {
    name: 'newest + заблокированные даты',
    query: `check_in=${blockIn}&check_out=${blockOut}`,
  },
  {
    name: 'гости + цена + тип + даты',
    query: `${dates}&guests=6&price_min=300000&price_max=1200000&type=house,villa`,
  },
];

function percentile(values, p) {
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index] ?? 0;
}

for (const scenario of SCENARIOS) {
  const url = `${base}/api/v1/listings?limit=24${scenario.query ? `&${scenario.query}` : ''}`;
  for (let index = 0; index < 3; index += 1) {
    const warmup = await fetch(url);
    if (!warmup.ok) throw new Error(`${url}: ${warmup.status}`);
  }

  const timings = [];
  let count = 0;
  for (let index = 0; index < repeat; index += 1) {
    const started = performance.now();
    const response = await fetch(url);
    const body = await response.json();
    timings.push(performance.now() - started);
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    count = body.listings.length;
  }

  console.log(
    `${scenario.name}: ${count} домов, p50 ${percentile(timings, 50).toFixed(1)} мс, ` +
      `p95 ${percentile(timings, 95).toFixed(1)} мс, max ${Math.max(...timings).toFixed(1)} мс`,
  );
}
