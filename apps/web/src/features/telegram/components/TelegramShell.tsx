import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { getTelegramWebApp, hapticImpact, initTelegramUi, isTelegramWebApp } from '../model/webapp';

const BOOKING_ROUTE = /^\/listings\/[^/]+/;

function backAction(navigate: ReturnType<typeof useNavigate>): void {
  hapticImpact();
  if (window.history.length > 1) {
    navigate(-1);
    return;
  }

  navigate('/');
}

function useTelegramBackButton(pathname: string): void {
  const navigate = useNavigate();
  const app = isTelegramWebApp() ? getTelegramWebApp() : null;

  useEffect(() => {
    const button = app?.BackButton;
    if (!button) return;

    const onClick = () => backAction(navigate);
    if (pathname === '/') {
      button.hide();
      return;
    }

    button.show();
    button.onClick(onClick);

    return () => {
      button.offClick(onClick);
      button.hide();
    };
  }, [app, navigate, pathname]);
}

function useTelegramMainButton(pathname: string): void {
  const { t } = useTranslation();
  const app = isTelegramWebApp() ? getTelegramWebApp() : null;

  useEffect(() => {
    const button = app?.MainButton;
    if (!button) return;

    const visible = BOOKING_ROUTE.test(pathname);
    document.body.dataset.telegramMain = String(visible);

    if (!visible) {
      button.hide();
      return;
    }

    const onClick = () => {
      hapticImpact('medium');
      if (window.innerWidth < 1024) window.dispatchEvent(new Event('staynest:open-booking'));
      document.getElementById('booking')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    button.setText(t('telegram.openBooking'));
    button.onClick(onClick);
    button.show();

    return () => {
      button.offClick(onClick);
      button.hide();
      document.body.dataset.telegramMain = 'false';
    };
  }, [app, pathname, t]);
}

/**
 * Мост между Telegram WebApp и интерфейсом: тема, BackButton и MainButton
 * на карточке дома. Вне Telegram все эффекты ничего не делают.
 */
export function TelegramShell() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (isTelegramWebApp()) initTelegramUi();
  }, []);

  useTelegramBackButton(pathname);
  useTelegramMainButton(pathname);

  return null;
}
