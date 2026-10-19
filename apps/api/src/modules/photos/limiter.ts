/**
 * Простой семафор для CPU-тяжёлых операций (sharp). Очередь живёт в процессе:
 * на одном инстансе этого достаточно, при масштабировании выносится в воркер.
 */
export function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];

  function next(): void {
    if (active >= maxConcurrent) return;
    const run = queue.shift();
    if (run) run();
  }

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }

    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      next();
    }
  };
}
