import type { Client } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { seedListing } from './support/booking-fixtures';
import {
  createHarness,
  createUser,
  databaseUrl,
  describeDatabase,
  resetTestSchema,
} from './support/harness';
import type { Harness } from './support/harness';

const url = databaseUrl ?? '';

describeDatabase('SEO: robots, sitemap и HTML для роботов', () => {
  let client: Client;
  let h: Harness;
  let publishedId: string;
  let draftId: string;

  beforeAll(async () => {
    if (!url) return;
    client = await resetTestSchema(url);
    h = await createHarness();
    const owner = await createUser(h, 'seo-owner@example.ru', 'Хозяин');
    publishedId = await seedListing(h, owner.id);
    draftId = await seedListing(h, owner.id, { status: 'draft' });
  });

  afterAll(async () => {
    await h?.app.close();
    await client?.end();
  });

  it('отдаёт robots.txt с абсолютной ссылкой на sitemap', async () => {
    const response = await h.app.inject({ method: 'GET', url: '/robots.txt' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toContain('Disallow: /api/');
    expect(response.body).toContain('Sitemap: http://localhost:5173/sitemap.xml');
  });

  it('включает в sitemap только опубликованные дома', async () => {
    const response = await h.app.inject({ method: 'GET', url: '/sitemap.xml' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('application/xml');
    expect(response.body).toContain(`/listings/${publishedId}`);
    expect(response.body).not.toContain(draftId);
    expect(response.body).toContain('<lastmod>');
  });

  it('рендерит главную для роботов с абсолютной OG-картинкой', async () => {
    const response = await h.app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('http://localhost:5173/og-image.jpg');
    expect(response.body).toContain(`/listings/${publishedId}`);
  });

  it('рендерит Open Graph и JSON-LD для карточки', async () => {
    const response = await h.app.inject({ method: 'GET', url: `/listings/${publishedId}` });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('<title>Дом у озера · Суздаль — StayNest</title>');
    expect(response.body).toContain('property="og:title"');
    expect(response.body).toContain('application/ld+json');
    expect(response.body).toContain('LodgingBusiness');
  });

  it('не раскрывает черновик и битый id', async () => {
    const draft = await h.app.inject({ method: 'GET', url: `/listings/${draftId}` });
    const broken = await h.app.inject({ method: 'GET', url: '/listings/not-a-uuid' });

    expect(draft.statusCode).toBe(404);
    expect(broken.statusCode).toBe(404);
  });
});
