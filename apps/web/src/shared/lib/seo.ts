import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE_NAME = 'StayNest';
const DEFAULT_DESCRIPTION =
  'StayNest — аренда домов у леса и озера: свободные даты, честная цена и бронирование без переписок.';

export type SeoInput = {
  title: string;
  description?: string;
  /** Относительный или абсолютный URL обложки для Open Graph. */
  image?: string | null;
  type?: 'website' | 'article';
  /** Закрытые экраны не должны попадать в индекс. */
  noindex?: boolean;
};

/** Обрезает описание по границе слова: поисковики показывают ~155 символов. */
export function truncateMeta(text: string, max = 155): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;

  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return `${slice.slice(0, lastSpace > 0 ? lastSpace : max).trimEnd()}…`;
}

function absoluteUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, window.location.origin).toString();
}

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.append(element);
  }

  element.content = content;
}

function upsertCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.append(element);
  }

  element.href = href;
}

export function useSeo(input: SeoInput | null): void {
  const { pathname } = useLocation();
  const title = input?.title;
  const description = input?.description ?? DEFAULT_DESCRIPTION;
  const image = input?.image ?? null;
  const type = input?.type ?? 'website';
  const noindex = input?.noindex ?? false;

  useEffect(() => {
    if (!title) return;

    const pageTitle = title === SITE_NAME ? title : `${title} — ${SITE_NAME}`;
    const canonical = absoluteUrl(pathname);

    document.title = pageTitle;
    upsertMeta('name', 'description', description);
    upsertCanonical(canonical);
    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:type', type);
    upsertMeta('property', 'og:title', pageTitle);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('name', 'twitter:card', image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', pageTitle);
    upsertMeta('name', 'twitter:description', description);

    if (image) {
      const imageUrl = absoluteUrl(image);
      upsertMeta('property', 'og:image', imageUrl);
      upsertMeta('name', 'twitter:image', imageUrl);
    } else {
      document.head.querySelector('meta[property="og:image"]')?.remove();
      document.head.querySelector('meta[name="twitter:image"]')?.remove();
    }

    if (noindex) {
      upsertMeta('name', 'robots', 'noindex, nofollow');
    } else {
      document.head.querySelector('meta[name="robots"]')?.remove();
    }
  }, [description, image, noindex, pathname, title, type]);
}
