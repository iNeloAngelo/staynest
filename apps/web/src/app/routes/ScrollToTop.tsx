import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Новый маршрут начинается с заголовка. Возврат «назад» (POP) не трогаем,
 * чтобы браузер восстановил позицию в бесконечной выдаче.
 */
export function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType !== 'POP' && window.scrollY > 0) {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [navigationType, pathname]);

  return null;
}
