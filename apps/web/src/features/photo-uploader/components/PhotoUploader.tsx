import type { ListingPhotoDto } from '@staynest/shared';
import { MAX_PHOTOS_PER_LISTING } from '@staynest/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../../shared/lib/useOnline';
import { useToast } from '../../../shared/ui';
import { photoErrorKey } from '../model/errors';
import { usePhotoActions } from '../model/usePhotoActions';
import { usePhotoUploads } from '../model/usePhotoUploads';
import { DeletePhotoModal } from './DeletePhotoModal';
import { PhotoDropZone } from './PhotoDropZone';
import { PhotoGrid } from './PhotoGrid';
import { UploadQueue } from './UploadQueue';

type PhotoUploaderProps = {
  listingId: string;
  photos: ListingPhotoDto[];
};

function OfflineNote({ online }: { online: boolean }) {
  const { t } = useTranslation();
  if (online) return null;

  return (
    <p role="status" className="text-small text-warning-ink">
      {t('photos.offline')}
    </p>
  );
}

export function PhotoUploader({ listingId, photos }: PhotoUploaderProps) {
  const { t } = useTranslation();
  const online = useOnline();
  const toast = useToast();
  const uploads = usePhotoUploads(listingId, photos.length);
  const actions = usePhotoActions(listingId);
  const [confirm, setConfirm] = useState<ListingPhotoDto | null>(null);
  const uploading = uploads.items.some((item) => item.status === 'uploading');
  const disabled = !online || actions.remove.isPending || uploading;

  function remove(): void {
    const photo = confirm;
    if (!photo) return;
    actions.remove
      .mutateAsync(photo.id)
      .then(() => setConfirm(null))
      .catch((error: unknown) => {
        toast.show({ title: t(photoErrorKey(error)), tone: 'error' });
      });
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3 text-ink">{t('photos.title')}</h2>
        <span className="text-small text-ink-muted">
          {t('photos.counter', { count: photos.length, max: MAX_PHOTOS_PER_LISTING })}
        </span>
      </header>
      <p className="text-small text-ink-muted">{t('photos.hint')}</p>
      <OfflineNote online={online} />
      {photos.length > 0 ? (
        <PhotoGrid
          listingId={listingId}
          photos={photos}
          disabled={disabled}
          onRemove={setConfirm}
          onFiles={uploads.addFiles}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-small text-ink-muted">
          {t('photos.empty')}
        </p>
      )}
      <PhotoDropZone disabled={disabled} onFiles={uploads.addFiles} />
      <UploadQueue
        items={uploads.items}
        disabled={!online}
        onRetry={uploads.retry}
        onDismiss={uploads.dismiss}
      />
      <DeletePhotoModal
        photo={confirm}
        loading={actions.remove.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={remove}
      />
    </section>
  );
}
