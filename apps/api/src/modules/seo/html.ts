import type { PublicListing, PublicListingSummary } from '@staynest/shared';
import type { AppConfig } from '../../platform/config/index';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function absolute(webAppUrl: string, path: string): string {
  return new URL(path, `${webAppUrl}/`).toString();
}

function summaryText(listing: PublicListing): string {
  const facts = `Гостей: ${listing.maxGuests} · Спален: ${listing.bedrooms} · ${listing.city}`;
  return truncate(`${facts}. ${listing.description}`, 155);
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

/**
 * Минимальная HTML-страница для поисковых роботов и превью в мессенджерах.
 * Обычные посетители получают SPA от Caddy; сюда приходит только crawler.
 */
export function renderListingPage(listing: PublicListing, config: AppConfig): string {
  const canonical = absolute(config.webAppUrl, `/listings/${listing.id}`);
  const image = listing.coverPhoto
    ? absolute(config.webAppUrl, listing.coverPhoto.urls.lg)
    : absolute(config.webAppUrl, '/og-image.jpg');
  const title = `${listing.title} · ${listing.city} — StayNest`;
  const description = summaryText(listing);

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LodgingBusiness',
    name: listing.title,
    description: listing.description,
    image,
    url: canonical,
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.city,
      addressRegion: listing.region,
      addressCountry: listing.country,
    },
    priceRange: `${Math.round(listing.basePriceMinor / 100)} RUB`,
    amenityFeature: listing.amenities.map((amenity) => ({
      '@type': 'LocationFeatureSpecification',
      name: amenity.nameRu,
      value: true,
    })),
  });

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:site_name" content="StayNest">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:width" content="${listing.coverPhoto?.width ?? 1200}">
    <meta property="og:image:height" content="${listing.coverPhoto?.height ?? 630}">
    <meta property="og:image:alt" content="${escapeHtml(listing.title)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(image)}">
    <script type="application/ld+json">${jsonLd.replaceAll('<', '\\u003c')}</script>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(listing.title)}</h1>
      <p>${escapeHtml(listing.city)}, ${escapeHtml(listing.region ?? '')}</p>
      <p>${escapeHtml(listing.description)}</p>
      <img src="${escapeHtml(image)}" alt="${escapeHtml(listing.title)}" width="1000" height="750">
      <p><a href="${escapeHtml(canonical)}">Открыть календарь и забронировать</a></p>
    </main>
  </body>
</html>`;
}

/** Главная для краулеров: абсолютные OG-теги и ссылки на опубликованные дома. */
export function renderHomePage(listings: PublicListingSummary[], config: AppConfig): string {
  const canonical = absolute(config.webAppUrl, '/');
  const image = absolute(config.webAppUrl, '/og-image.jpg');
  const title = 'StayNest — аренда домов у леса и озера';
  const description =
    'Дома в Суздале, Плёсе, Костроме и Твери: свободные даты, честная цена и заявка на бронирование без переписок.';

  const cards = listings
    .map((listing) => {
      const href = absolute(config.webAppUrl, `/listings/${listing.id}`);
      const cover = listing.coverPhoto
        ? absolute(config.webAppUrl, listing.coverPhoto.urls.md)
        : image;
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(listing.title)}, ${escapeHtml(listing.city)}</a><br><img src="${escapeHtml(cover)}" alt="" width="400" height="300"></li>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
    <link rel="canonical" href="${escapeHtml(canonical)}">
    <meta property="og:site_name" content="StayNest">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${escapeHtml(title)}">
    <meta property="og:description" content="${escapeHtml(description)}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    <meta property="og:image" content="${escapeHtml(image)}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="StayNest — дома у леса и озера">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:image" content="${escapeHtml(image)}">
  </head>
  <body>
    <main>
      <h1>Дома у леса и озера</h1>
      <p>${escapeHtml(description)}</p>
      <ul>${cards}</ul>
      <p><a href="${escapeHtml(canonical)}">Открыть каталог StayNest</a></p>
    </main>
  </body>
</html>`;
}
