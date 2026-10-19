import { useEffect, useRef } from 'react';

type InfiniteScrollOptions = {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => unknown;
};

/**
 * Автоподгрузка при появлении sentinel. Кнопка «Показать ещё» остаётся
 * запасным путём: IntersectionObserver может отсутствовать или быть отключён.
 */
export function useInfiniteScroll<T extends Element>({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InfiniteScrollOptions) {
  const sentinelRef = useRef<T>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      { rootMargin: '400px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return sentinelRef;
}
