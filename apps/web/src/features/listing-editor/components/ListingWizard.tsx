import type { ListingDto } from '@staynest/shared';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ListingIssuesAlert, ListingStatusBadge, issueTextKey } from '../../listings';
import { Button, Modal, Stepper } from '../../../shared/ui';
import { LAST_STEP, WIZARD_STEPS } from '../model/steps';
import { useListingWizard } from '../model/useListingWizard';
import { AutosaveStatus } from './AutosaveStatus';
import { StepPanel } from './StepPanel';
import { WizardFooter, WizardDangerZone } from './WizardFooter';
import { WizardNotices } from './WizardNotices';

function WizardHeader({
  title,
  city,
  status,
  saveStatus,
}: {
  title: string;
  city: string;
  status: ListingDto['status'];
  saveStatus: ReturnType<typeof useListingWizard>['status'];
}) {
  const { t } = useTranslation();

  return (
    <header className="flex flex-col gap-3">
      <Link
        to="/host/listings"
        className="inline-flex min-h-11 w-fit items-center gap-1 text-small font-medium text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('listings.editor.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 break-words text-ink">{title}</h1>
          <p className="mt-1 text-small text-ink-muted">{city}</p>
          <div className="mt-2">
            <AutosaveStatus status={saveStatus} />
          </div>
        </div>
        <ListingStatusBadge status={status} />
      </div>
    </header>
  );
}

function WizardProgress({
  step,
  maxReached,
  labels,
  onSelect,
}: {
  step: number;
  maxReached: number;
  labels: Array<{ id: string; label: string }>;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  const total = labels.length;
  const current = step + 1;
  const percent = (current / total) * 100;

  return (
    <section aria-label={t('listings.wizard.progressLabel')} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-small font-semibold text-ink">
          {t('listings.wizard.progress', { current, total })}
        </p>
        <p className="text-small text-ink-muted">{labels[step]?.label}</p>
      </div>
      <div
        role="progressbar"
        aria-label={t('listings.wizard.progressLabel')}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={t('listings.wizard.progress', { current, total })}
        className="h-2 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <Stepper
        steps={labels}
        current={step}
        maxReached={maxReached}
        label={t('listings.wizard.nav')}
        onSelect={onSelect}
      />
    </section>
  );
}

function WizardErrors({ controller }: { controller: ReturnType<typeof useListingWizard> }) {
  const { t } = useTranslation();

  const clientIssues = controller.clientIssues.map((item) => ({
    field: item.field,
    message: t(issueTextKey(item.code)),
  }));
  const serverIssues = controller.publishIssues.map((item) => ({
    field: item.field,
    message: t(issueTextKey(item.code)),
  }));

  return (
    <>
      <ListingIssuesAlert
        title={t('listings.formIssues.title')}
        issues={clientIssues}
        onFieldSelect={(field) => controller.focusIssue({ field })}
      />
      <ListingIssuesAlert
        title={t('listings.issues.title')}
        issues={serverIssues}
        onFieldSelect={(field) => controller.focusIssue({ field })}
      />
    </>
  );
}

function ConfirmDialog({ controller }: { controller: ReturnType<typeof useListingWizard> }) {
  const { t } = useTranslation();
  const isArchive = controller.confirm === 'archive';

  return (
    <Modal
      open={controller.confirm !== null}
      onClose={() => controller.setConfirm(null)}
      title={
        isArchive
          ? t('listings.editor.confirmArchiveTitle')
          : t('listings.editor.confirmDeleteTitle')
      }
      footer={
        <>
          <Button variant="secondary" onClick={() => controller.setConfirm(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant={isArchive ? 'primary' : 'danger'}
            loading={isArchive ? controller.archiving : controller.deleting}
            onClick={() => {
              controller.setConfirm(null);
              if (isArchive) void controller.archiveNow();
              else void controller.removeNow();
            }}
          >
            {isArchive ? t('listings.editor.archive') : t('listings.editor.delete')}
          </Button>
        </>
      }
    >
      <p>
        {isArchive
          ? t('listings.editor.confirmArchiveBody')
          : t('listings.editor.confirmDeleteBody')}
      </p>
    </Modal>
  );
}

function useStepHeadingFocus(step: number, hasIssues: boolean) {
  const ref = useRef<HTMLHeadingElement>(null);
  const previous = useRef(step);

  useEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    if (hasIssues) return;
    ref.current?.focus();
  }, [step, hasIssues]);

  return ref;
}

function useWizardSubmit(step: number, goNext: () => unknown) {
  return (event: FormEvent): void => {
    event.preventDefault();
    if (step < LAST_STEP) goNext();
  };
}

export function ListingWizard({ listing }: { listing: ListingDto }) {
  const { t } = useTranslation();
  const controller = useListingWizard(listing);
  const title = controller.state.title.trim() || t('listings.editor.newTitle');
  const city = controller.state.city.trim() || t('listings.noCity');
  const labels = WIZARD_STEPS.map((step) => ({ id: step.id, label: t(step.labelKey) }));
  const hasIssues = controller.clientIssues.length > 0 || controller.publishIssues.length > 0;
  const stepHeadingRef = useStepHeadingFocus(controller.step, hasIssues);
  const submit = useWizardSubmit(controller.step, controller.goNext);
  return (
    <div id="wizard-top" className="flex scroll-mt-24 flex-col gap-5">
      <WizardHeader
        title={title}
        city={city}
        status={listing.status}
        saveStatus={controller.status}
      />
      {!controller.online ? (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-small text-warning-ink"
        >
          {t('listings.offline')}
        </p>
      ) : null}

      <WizardNotices controller={controller} />

      <WizardProgress
        step={controller.step}
        maxReached={controller.maxReached}
        labels={labels}
        onSelect={controller.goTo}
      />

      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <WizardErrors controller={controller} />

        <h2 id="wizard-step-heading" ref={stepHeadingRef} tabIndex={-1} className="sr-only">
          {t('listings.wizard.stepHeading', {
            current: controller.step + 1,
            label: labels[controller.step]?.label,
          })}
        </h2>

        <fieldset disabled={Boolean(controller.conflictDraft)} className="min-w-0 border-0 p-0">
          <StepPanel controller={controller} listing={listing} />
        </fieldset>

        {controller.step === 0 || controller.step === LAST_STEP ? (
          <WizardDangerZone controller={controller} status={listing.status} />
        ) : null}

        <WizardFooter controller={controller} status={listing.status} />
      </form>

      <ConfirmDialog controller={controller} />
    </div>
  );
}
