import { ArrowLeft, ArrowRight, Archive, Save, Send, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ListingStatus } from '@staynest/shared';
import { Button } from '../../../shared/ui';
import type { ListingWizardController } from '../model/useListingWizard';
import { LAST_STEP } from '../model/steps';

type Props = {
  controller: ListingWizardController;
  status: ListingStatus;
};

function SaveButton({
  controller,
  disabled,
}: {
  controller: ListingWizardController;
  disabled: boolean;
}) {
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      onClick={() => void controller.saveNow()}
      disabled={disabled}
      loading={controller.saving}
      aria-label={t('listings.editor.save')}
      leftIcon={<Save className="size-5" aria-hidden="true" />}
    >
      <span className="hidden sm:inline">{t('listings.editor.save')}</span>
    </Button>
  );
}

function PrimaryActions({ controller, status }: Props) {
  const { t } = useTranslation();
  const conflictOpen = Boolean(controller.conflictDraft);
  const networkBusy = controller.publishing || controller.archiving || controller.deleting;

  if (controller.step < LAST_STEP) {
    return (
      <Button
        onClick={controller.goNext}
        disabled={networkBusy}
        rightIcon={<ArrowRight className="size-5" aria-hidden="true" />}
      >
        {t('listings.wizard.next')}
      </Button>
    );
  }

  if (status !== 'published') {
    return (
      <Button
        onClick={() => void controller.publishNow()}
        disabled={!controller.online || networkBusy || controller.saving || conflictOpen}
        loading={controller.publishing}
        leftIcon={<Send className="size-5" aria-hidden="true" />}
      >
        {controller.publishing ? t('listings.editor.publishing') : t('listings.editor.publish')}
      </Button>
    );
  }

  return (
    <Button
      variant="secondary"
      onClick={() => controller.setConfirm('archive')}
      disabled={networkBusy || conflictOpen || !controller.online}
      loading={controller.archiving}
      leftIcon={<Archive className="size-5" aria-hidden="true" />}
    >
      {controller.archiving ? t('listings.editor.archiving') : t('listings.editor.archive')}
    </Button>
  );
}

export function WizardFooter({ controller, status }: Props) {
  const { t } = useTranslation();
  const networkBusy = controller.publishing || controller.archiving || controller.deleting;
  const saveDisabled =
    !controller.online || networkBusy || controller.saving || Boolean(controller.conflictDraft);

  return (
    <nav
      aria-label={t('listings.wizard.actions')}
      className="sticky bottom-nav z-30 -mx-4 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:mx-0 lg:rounded-lg lg:border"
    >
      <div className="flex flex-wrap items-center gap-2">
        {controller.step > 0 ? (
          <Button
            variant="secondary"
            onClick={controller.goBack}
            disabled={networkBusy}
            leftIcon={<ArrowLeft className="size-5" aria-hidden="true" />}
          >
            {t('listings.wizard.back')}
          </Button>
        ) : null}

        <div className="ml-auto flex flex-wrap gap-2">
          <SaveButton controller={controller} disabled={saveDisabled} />
          <PrimaryActions controller={controller} status={status} />
        </div>
      </div>
    </nav>
  );
}

export function WizardDangerZone({ controller, status }: Props) {
  const { t } = useTranslation();
  if (status !== 'draft') return null;

  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-4">
      <p className="max-w-prose text-small text-ink-muted">{t('listings.wizard.deleteHint')}</p>
      <Button
        variant="danger"
        onClick={() => controller.setConfirm('delete')}
        disabled={!controller.online || controller.deleting || controller.publishing}
        leftIcon={<Trash2 className="size-5" aria-hidden="true" />}
      >
        {t('listings.editor.delete')}
      </Button>
    </section>
  );
}
