import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { IconButton } from './IconButton';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapTab(event: KeyboardEvent, panel: HTMLDivElement, items: HTMLElement[]): void {
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return;

  const active = document.activeElement;
  const inside = Boolean(active && panel.contains(active) && items.includes(active as HTMLElement));

  // Фокус на самой панели (tabIndex=-1) или вне диалога: заворачиваем внутрь.
  if (!inside) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
    return;
  }

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

function useDialogFocus(open: boolean, onClose: () => void): RefObject<HTMLDivElement | null> {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;

    const panel = panelRef.current;
    if (!panel) return;
    const dialogPanel: HTMLDivElement = panel;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusables = (): HTMLElement[] =>
      Array.from(dialogPanel.querySelectorAll<HTMLElement>(FOCUSABLE));

    (focusables()[0] ?? dialogPanel).focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      trapTab(event, dialogPanel, items);
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  return panelRef;
}

type DialogShellProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  variant: 'modal' | 'sheet';
};

export function DialogShell({ open, onClose, title, children, footer, variant }: DialogShellProps) {
  const { t } = useTranslation();
  const panelRef = useDialogFocus(open, onClose);
  const titleId = useId();

  if (!open) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-50 flex justify-center',
        variant === 'sheet' ? 'items-end' : 'items-end sm:items-center',
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('ui.modal.close')}
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink/40"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[90dvh] w-full flex-col overflow-hidden bg-surface shadow-lg',
          variant === 'sheet'
            ? 'animate-sheet max-w-lg rounded-t-lg pb-safe'
            : 'animate-dialog rounded-t-lg pb-safe sm:max-w-lg sm:rounded-lg sm:pb-0',
        )}
      >
        {variant === 'sheet' ? (
          <span
            className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border"
            aria-hidden="true"
          />
        ) : null}

        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <h2 id={titleId} className="text-h2 text-ink">
            {title}
          </h2>

          <IconButton label={t('ui.modal.close')} onClick={onClose} className="-mt-2 -mr-2">
            <X className="size-5" aria-hidden="true" />
          </IconButton>
        </header>

        <div className="overflow-y-auto px-6 pb-4 text-body text-ink-muted">{children}</div>

        {footer ? (
          <footer className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
