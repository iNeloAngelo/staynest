import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { z } from 'zod';
import type { AppConfig } from '../../platform/config/index';
import type { Db } from '../../platform/db/index';
import type { MediaStorage } from '../../platform/storage/index';
import { createCatalogService } from '../catalog/index';
import { catalogListingNotFound } from '../catalog/index';
import { renderHomePage, renderListingPage } from './html';

type SeoRoutesOptions = {
  db: Db;
  config: AppConfig;
  storage: MediaStorage;
};

function text(reply: FastifyReply, type: string, body: string): FastifyReply {
  reply.header('content-type', type);
  reply.header('cache-control', 'public, max-age=600, stale-while-revalidate=3600');
  return reply.send(body);
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function sitemap(entries: { id: string; publishedAt: string | null }[], baseUrl: string): string {
  const urls = [
    `<url><loc>${escapeXml(baseUrl)}/</loc><changefreq>daily</changefreq></url>`,
    ...entries.map((entry) => {
      const lastmod = entry.publishedAt
        ? `<lastmod>${entry.publishedAt.slice(0, 10)}</lastmod>`
        : '';
      return `<url><loc>${escapeXml(`${baseUrl}/listings/${entry.id}`)}</loc>${lastmod}</url>`;
    }),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;
}

function robots(baseUrl: string): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /media/',
    'Disallow: /profile',
    'Disallow: /trips',
    'Disallow: /favorites',
    'Disallow: /bookings/',
    'Disallow: /host',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

export const seoRoutes: FastifyPluginAsync<SeoRoutesOptions> = async (app, options) => {
  const catalog = createCatalogService({ db: options.db, storage: options.storage });
  const baseUrl = options.config.webAppUrl;

  app.get('/', async (_request, reply) => {
    const page = await catalog.list({ limit: 12 });
    return text(reply, 'text/html; charset=utf-8', renderHomePage(page.listings, options.config));
  });

  app.get('/sitemap.xml', async (_request, reply) => {
    const entries = await catalog.sitemapEntries();
    return text(reply, 'application/xml; charset=utf-8', sitemap(entries, baseUrl));
  });

  app.get('/robots.txt', async (_request, reply) => {
    return text(reply, 'text/plain; charset=utf-8', robots(baseUrl));
  });

  // Этот маршрут попадает только на crawler-запросы (см. infra/Caddyfile).
  app.get('/listings/:id', async (request, reply) => {
    const id = (request.params as { id?: unknown }).id;
    if (typeof id !== 'string' || !z.uuid().safeParse(id).success) {
      throw catalogListingNotFound();
    }

    const listing = await catalog.detail(id);
    return text(reply, 'text/html; charset=utf-8', renderListingPage(listing, options.config));
  });
};
