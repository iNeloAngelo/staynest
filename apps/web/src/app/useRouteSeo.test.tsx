import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useRouteSeo } from './useRouteSeo';

function RouteSeo() {
  useRouteSeo();
  return null;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteSeo />
    </MemoryRouter>,
  );
}

afterEach(() => {
  document.head
    .querySelectorAll('meta[property^="og:"], meta[name^="twitter:"], meta[name="robots"]')
    .forEach((node) => node.remove());
  document.head.querySelector('link[rel="canonical"]')?.remove();
});

describe('useRouteSeo', () => {
  it('ставит SEO для страницы входа, а не оставляет карточку', () => {
    renderAt('/login');

    expect(document.title).toBe('Вход — StayNest');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toContain(
      '/login',
    );
    expect(
      document.head.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    ).toContain('/og-image.jpg');
  });

  it('закрывает приватные экраны от индексации', () => {
    renderAt('/profile');

    expect(document.title).toBe('Профиль — StayNest');
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
  });

  it('не перебивает SEO каталога и карточки', () => {
    renderAt('/listings/abc');

    expect(document.title).not.toContain('Страница не найдена');
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
