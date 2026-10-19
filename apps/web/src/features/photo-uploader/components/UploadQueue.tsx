import { AlertCircle, Check, Loader2, RotateCcw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../../shared/ui';
import type { UploadItem } from '../model/usePhotoUploads';

type UploadQueueProps = {
  items: UploadItem[];
  disabled: boolean;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
};

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  if (status === 'done') return <Check className="size-5 text-success" aria-hidden="true" />;
  if (status === 'error') return <AlertCircle className="size-5 text-danger" aria-hidden="true" />;
  return <Loader2 className="size-5 animate-spin text-ink-muted" aria-hidden="true" />;
}

function UploadStatus({ item }: { item: UploadItem }) {
  const { t } = useTranslation();
  const active = item.status === 'compressing' || item.status === 'uploading';
  const text =
    item.status === 'error'
      ? item.errorKey
        ? t(item.errorKey)
        : t('photos.errors.generic')
      : item.status === 'done'
        ? t('photos.uploaded')
        : item.status === 'compressing'
          ? t('photos.compressing')
          : t('photos.uploading');

  return (
    <>
      <span
        role="status"
        aria-live="polite"
        className={
          item.status === 'error'
            ? 'text-caption text-danger'
            : item.status === 'done'
              ? 'text-caption text-success-ink'
              : 'text-caption text-ink-muted'
        }
      >
        {text}
      </span>
      {active ? (
        <div
          role="progressbar"
          aria-label={t('photos.progress', { name: item.name })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={item.progress}
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full w-full origin-left rounded-full bg-primary transition-transform duration-micro"
            style={{ transform: `scaleX(${item.progress / 100})` }}
          />
        </div>
      ) : null}
    </>
  );
}

export function UploadQueue({ items, disabled, onRetry, onDismiss }: UploadQueueProps) {
  const { t } = useTranslation();

  if (items.length === 0) return null;

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-md border border-border bg-surface p-2"
        >
          <img
            src={item.previewUrl}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-sm object-cover"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-small font-medium text-ink">{item.name}</span>
            <UploadStatus item={item} />
          </div>

          <span className="flex shrink-0 items-center gap-1">
            <StatusIcon status={item.status} />

            {item.status === 'error' ? (
              <IconButton
                label={t('photos.retry')}
                disabled={disabled}
                onClick={() => onRetry(item.id)}
              >
                <RotateCcw className="size-5" aria-hidden="true" />
              </IconButton>
            ) : null}

            {item.status === 'error' ? (
              <IconButton label={t('photos.dismiss')} onClick={() => onDismiss(item.id)}>
                <X className="size-5" aria-hidden="true" />
              </IconButton>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
