import type { ListingDto } from '@staynest/shared';
import { ArrowLeft, Archive, Save, Send, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useOnline } from '../../../shared/lib/useOnline';
import { Button, Modal } from '../../../shared/ui';
import {
  ListingBasicsSection,
  ListingCapacitySection,
  ListingLocationSection,
  ListingStaySection,
} from './ListingFormSections';
import type { SectionProps } from './form-parts';
import {
  ListingAmenitiesSection,
  ListingPriceSection,
  ListingRulesSection,
} from './ListingPriceSections';
import { ListingIssuesAlert } from './ListingIssuesAlert';
import { ListingStatusBadge } from './ListingStatusBadge';
import { issueTextKey } from '../model/errors';
import { useListingActions, useListingForm } from '../model/useListingEditor';
import type { ListingFormState } from '../model/form';

type Editor = ReturnType<typeof useListingActions> & {
  setField: <K extends keyof ListingFormState>(field: K, value: ListingFormState[K]) => void;
};

function ListingEditorHeader({ listing }: { listing: ListingDto }) {
  const { t } = useTranslation();
  const title = listing.title?.trim() || t('listings.editor.newTitle');

  return (
    <header className="flex flex-col gap-3">
      <Link
        to="/host/listings"
        className="inline-flex w-fit items-center gap-1 text-small font-medium text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('listings.editor.back')}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 break-words text-ink">{title}</h1>
          <p className="mt-1 text-small text-ink-muted">
            {listing.city?.trim() || t('listings.noCity')}
          </p>
        </div>
        <ListingStatusBadge status={listing.status} />
      </div>
    </header>
  );
}

type ActionsProps = {
  status: ListingDto['status'];
  saving: boolean;
  publishing: boolean;
  archiving: boolean;
  deleting: boolean;
  onPublish: () => void;
  onArchive: () => void;
  onDelete: () => void;
};

function EditorHint() {
  const { t } = useTranslation();

  return <p className="text-caption text-ink-muted">{t('listings.editor.hint')}</p>;
}

function ListingEditorActions({
  status,
  saving,
  publishing,
  archiving,
  deleting,
  onPublish,
  onArchive,
  onDelete,
}: ActionsProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const busy = saving || publishing || archiving || deleting || !online;

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant={status !== 'published' ? 'secondary' : 'primary'}
          loading={saving}
          disabled={busy}
          leftIcon={<Save className="size-5" aria-hidden="true" />}
        >
          {saving ? t('listings.editor.saving') : t('listings.editor.save')}
        </Button>

        {status === 'published' ? (
          <Button
            variant="secondary"
            loading={archiving}
            disabled={busy}
            onClick={onArchive}
            leftIcon={<Archive className="size-5" aria-hidden="true" />}
          >
            {archiving ? t('listings.editor.archiving') : t('listings.editor.archive')}
          </Button>
        ) : (
          <Button
            loading={publishing}
            disabled={busy}
            onClick={onPublish}
            leftIcon={<Send className="size-5" aria-hidden="true" />}
          >
            {publishing ? t('listings.editor.publishing') : t('listings.editor.publish')}
          </Button>
        )}

        {status === 'draft' ? (
          <Button
            variant="danger"
            disabled={busy}
            onClick={onDelete}
            leftIcon={<Trash2 className="size-5" aria-hidden="true" />}
          >
            {t('listings.editor.delete')}
          </Button>
        ) : null}
      </div>

      <EditorHint />
    </section>
  );
}

function ListingEditorForm({
  listing,
  state,
  editor,
  onArchive,
  onDelete,
}: {
  listing: ListingDto;
  state: ListingFormState;
  editor: Editor;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const sectionProps: SectionProps = {
    state,
    setField: editor.setField,
    errors: editor.formErrors,
  };

  function submit(event: FormEvent): void {
    event.preventDefault();
    void editor.save();
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <ListingBasicsSection {...sectionProps} />
      <ListingLocationSection {...sectionProps} />
      <ListingCapacitySection {...sectionProps} />
      <ListingStaySection {...sectionProps} />
      <ListingPriceSection {...sectionProps} />
      <ListingAmenitiesSection {...sectionProps} />
      <ListingRulesSection {...sectionProps} />

      <ListingEditorActions
        status={listing.status}
        saving={editor.saving}
        publishing={editor.publishing}
        archiving={editor.archiving}
        deleting={editor.deleting}
        onPublish={() => void editor.publishNow()}
        onArchive={onArchive}
        onDelete={onDelete}
      />
    </form>
  );
}

type ConfirmModalProps = {
  open: boolean;
  title: string;
  body: string;
  actionLabel: string;
  danger?: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function ConfirmModal({
  open,
  title,
  body,
  actionLabel,
  danger = false,
  loading,
  onClose,
  onConfirm,
}: ConfirmModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>
            {actionLabel}
          </Button>
        </>
      }
    >
      <p>{body}</p>
    </Modal>
  );
}

function ListingEditorDialogs({
  editor,
  confirm,
  onClose,
}: {
  editor: Editor;
  confirm: 'archive' | 'delete' | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <ConfirmModal
        open={confirm === 'archive'}
        title={t('listings.editor.confirmArchiveTitle')}
        body={t('listings.editor.confirmArchiveBody')}
        actionLabel={t('listings.editor.archive')}
        loading={editor.archiving}
        onClose={onClose}
        onConfirm={() => {
          onClose();
          void editor.archiveNow();
        }}
      />

      <ConfirmModal
        open={confirm === 'delete'}
        title={t('listings.editor.confirmDeleteTitle')}
        body={t('listings.editor.confirmDeleteBody')}
        actionLabel={t('listings.editor.delete')}
        danger
        loading={editor.deleting}
        onClose={onClose}
        onConfirm={() => {
          onClose();
          void editor.removeNow();
        }}
      />
    </>
  );
}

export function ListingEditor({ listing }: { listing: ListingDto }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const online = useOnline();
  const { state, setField } = useListingForm(listing);
  const actions = useListingActions(listing, state, () => navigate('/host/listings'));
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const editor: Editor = { ...actions, setField };

  const issues = actions.publishIssues.map((issue) => ({
    field: issue.field,
    message: t(issueTextKey(issue.code)),
  }));
  const formIssues = Object.entries(actions.formErrors).map(([field, message]) => ({
    field,
    message: message ?? '',
  }));

  return (
    <div className="flex flex-col gap-6">
      <ListingEditorHeader listing={listing} />

      {!online ? (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-small text-warning-ink"
        >
          {t('listings.offline')}
        </p>
      ) : null}

      <ListingIssuesAlert title={t('listings.issues.title')} issues={issues} />
      <ListingIssuesAlert title={t('listings.formIssues.title')} issues={formIssues} />

      <ListingEditorForm
        listing={listing}
        state={state}
        editor={editor}
        onArchive={() => setConfirm('archive')}
        onDelete={() => setConfirm('delete')}
      />

      <ListingEditorDialogs editor={editor} confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
