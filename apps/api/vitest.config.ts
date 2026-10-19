import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Интеграционные тесты работают с одной тестовой базой: файлы не должны конкурировать.
    fileParallelism: false,
    restoreMocks: true,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
