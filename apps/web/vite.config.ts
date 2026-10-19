import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  // .env лежит в корне монорепо: pnpm запускает конфиг из apps/web.
  const env = loadEnv(mode, '../..', '');
  const s3Endpoint = env.S3_ENDPOINT || 'http://localhost:9000';
  const s3Bucket = env.S3_BUCKET || 'staynest-media';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '127.0.0.1',
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3100',
          changeOrigin: false,
        },
        // В dev Caddy нет: раздаём объекты Silo напрямую, как /media в проде.
        '/media': {
          target: s3Endpoint,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/media/, `/${s3Bucket}`),
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      restoreMocks: true,
      // Мастер объявления в jsdom занимает ~4 с; при параллельном прогоне
      // дефолтные 5 с дают флап. Это верхняя граница, а не цель.
      testTimeout: 15_000,
      hookTimeout: 15_000,
    },
  };
});
