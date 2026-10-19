/**
 * Возвращает только локальный путь приложения: защита от open redirect
 * через `?next=https://evil.example` или `//evil.example`.
 */
export function safeNext(raw: string | null | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  if (raw.startsWith('/login') || raw.startsWith('/register')) return '/';

  return raw;
}
