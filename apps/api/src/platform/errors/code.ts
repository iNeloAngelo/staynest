export function errorCode(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const value = (error as { code?: unknown }).code;
    if (typeof value === 'string') return value;
  }

  return 'unknown';
}
