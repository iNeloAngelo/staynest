export type ClassValue = string | false | null | undefined;

/** Склеивает классы, отбрасывая пустые значения. Без внешних зависимостей. */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(' ');
}
