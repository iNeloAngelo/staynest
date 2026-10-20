import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useSeo } from './seo';

function Seo({ noindex = false }: { noindex?: boolean }) {
  useSeo({
    title: 'Дом у озера',
    description: 'Тихий дом с камином',
    image: '/media/cover.webp',
    type: 'article',
    noindex,
  });
  return null;
}

function meta(selector: string): string | null {
  return document.head.querySelector<HTMLMetaElement>(selector)?.content ?? null;
}

afterEach(() => {
  document.head
    .querySelectorAll('meta[property^="og:"], meta[name^="twitter:"], meta[name="robots"]')
    .forEach((node) => node.remove());
  document.head.querySelector('link[rel="canonical"]')?.remove();
});

describe('useSeo', () => {
  it('ставит заголовок, описание, canonical и Open Graph', () => {
    render(
      <MemoryRouter initialEntries={['/listings/abc']}>
        <Seo />
      </MemoryRouter>,
    );

    expect(document.title).toBe('Дом у озера — StayNest');
    expect(meta('meta[name="description"]')).toBe('Тихий дом с камином');
    expect(meta('meta[property="og:title"]')).toBe('Дом у озера — StayNest');
    expect(meta('meta[property="og:type"]')).toBe('article');
    expect(meta('meta[property="og:image"]')).toContain('/media/cover.webp');
    expect(meta('meta[name="twitter:card"]')).toBe('summary_large_image');
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain(
      '/listings/abc',
    );
  });

  it('добавляет noindex и убирает его при обычной странице', () => {
    const view = render(
      <MemoryRouter initialEntries={['/profile']}>
        <Seo noindex />
      </MemoryRouter>,
    );

    expect(meta('meta[name="robots"]')).toBe('noindex, nofollow');

    view.rerender(
      <MemoryRouter initialEntries={['/profile']}>
        <Seo />
      </MemoryRouter>,
    );

    expect(meta('meta[name="robots"]')).toBeNull();
  });
});
