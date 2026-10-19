import { AlertCircle, Info, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '../../../shared/ui';
import type { ListingWizardController } from '../model/useListingWizard';

function focusNotice(element: HTMLElement | null): void {
  if (!element) return;
  element.focus();
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'center' });
  }
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();

  return (
    <IconButton label={t('ui.modal.close')} onClick={onDismiss} className="-mt-1 -mr-1 shrink-0">
      <X className="size-4" aria-hidden="true" />
    </IconButton>
  );
}

function DraftNotice({ controller }: { controller: ListingWizardController }) {
  const { t } = useTranslation();
  const notice = controller.notice;
  if (!notice || notice.kind === 'conflict') return null;

  const text =
    notice.kind === 'restored'
      ? t('listings.wizard.restored', { step: notice.step + 1 })
      : t('listings.wizard.resumed', { step: notice.step + 1 });

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/5 px-4 py-3 text-small text-ink"
    >
      <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
      <p className="flex-1">{text}</p>
      <DismissButton onDismiss={controller.dismissNotice} />
    </div>
  );
}

function ConflictNotice({ controller }: { controller: ListingWizardController }) {
  const { t } = useTranslation();
  if (!controller.conflictDraft) return null;

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-small text-ink"
    >
      <p className="text-body font-semibold text-warning-ink">
        {t('listings.wizard.conflict.title')}
      </p>
      <p>{t('listings.wizard.conflict.body')}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={controller.keepServer}>
          {t('listings.wizard.conflict.keepServer')}
        </Button>
        <Button onClick={controller.restoreMine}>{t('listings.wizard.conflict.keepMine')}</Button>
      </div>
    </div>
  );
}

function ActionError({ controller }: { controller: ListingWizardController }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (controller.actionError) focusNotice(ref.current);
  }, [controller.actionError]);

  if (!controller.actionError) return null;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-small text-ink"
    >
      <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden="true" />
      <p className="flex-1">{t(controller.actionError)}</p>
      {controller.actionConflict ? (
        <Button variant="secondary" onClick={controller.refreshConflict}>
          {t('listings.wizard.conflict.refresh')}
        </Button>
      ) : null}
    </div>
  );
}

function SaveError({ controller }: { controller: ListingWizardController }) {
  const { t } = useTranslation();
  const visible =
    Boolean(controller.errorKey) &&
    controller.status === 'error' &&
    controller.publishIssues.length === 0;

  if (!visible || !controller.errorKey) return null;

  return (
    <div
      tabIndex={-1}
      role="alert"
      className="flex flex-wrap items-center gap-3 rounded-lg border border-danger/40 bg-danger/10 p-4 text-small text-ink"
    >
      <AlertCircle className="size-5 shrink-0 text-danger" aria-hidden="true" />
      <p className="flex-1">{t(controller.errorKey)}</p>
      <Button
        variant="secondary"
        disabled={!controller.online || controller.saving}
        onClick={() => void controller.saveNow()}
      >
        {t('listings.wizard.retrySave')}
      </Button>
    </div>
  );
}

export function WizardNotices({ controller }: { controller: ListingWizardController }) {
  return (
    <>
      <DraftNotice controller={controller} />
      <ConflictNotice controller={controller} />
      <ActionError controller={controller} />
      <SaveError controller={controller} />
    </>
  );
}
