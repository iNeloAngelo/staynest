/**
 * Нарушение exclusion constraint в PostgreSQL.
 * SQLSTATE `23P01`, а не `23505`: это не unique, а пересечение диапазонов.
 */
export function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23P01'
  );
}
