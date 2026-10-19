import { AlertCircle, Check, CloudOff, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import type { SaveStatus } from '../model/useWizardPersistence';

const STATUS_KEYS: Record<SaveStatus, TranslationKey> = {
  saved: 'listings.wizard.save.saved',
  pending: 'listings.wizard.save.pending',
  saving: 'listings.wizard.save.saving',
  offline: 'listings.wizard.save.offline',
  error: 'listings.wizard.save.error',
};

function StatusIcon({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return <Loader2 className="size-4 animate-spin" aria-hidden="true" />;
  }
  if (status === 'offline') return <CloudOff className="size-4" aria-hidden="true" />;
  if (status === 'error') return <AlertCircle className="size-4" aria-hidden="true" />;
  if (status === 'saved') return <Check className="size-4" aria-hidden="true" />;
  return <span className="size-2 rounded-full bg-current" aria-hidden="true" />;
}

const TONE: Record<SaveStatus, string> = {
  saved: 'text-success-ink',
  pending: 'text-ink-muted',
  saving: 'text-ink-muted',
  offline: 'text-warning-ink',
  error: 'text-danger',
};

export function AutosaveStatus({ status }: { status: SaveStatus }) {
  const { t } = useTranslation();

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-small ${TONE[status]}`}
    >
      <StatusIcon status={status} />
      {t(STATUS_KEYS[status])}
    </span>
  );
}
