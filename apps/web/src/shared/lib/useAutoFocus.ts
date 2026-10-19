import { useEffect, useRef } from 'react';

/** Переводит фокус на элемент после появления в DOM (например, на итог формы). */
export function useAutoFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return ref;
}
