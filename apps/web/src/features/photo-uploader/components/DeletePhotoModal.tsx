import type { ListingPhotoDto } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../../shared/ui';

type DeletePhotoModalProps = {
  photo: ListingPhotoDto | null;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function DeletePhotoModal({ photo, loading, onClose, onConfirm }: DeletePhotoModalProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={photo !== null}
      onClose={onClose}
      title={t('photos.confirmDeleteTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" loading={loading} onClick={onConfirm}>
            {t('photos.remove')}
          </Button>
        </>
      }
    >
      <div className="flex items-center gap-3">
        {photo ? (
          <img
            src={photo.urls.thumb}
            alt=""
            width={56}
            height={56}
            className="size-14 shrink-0 rounded-sm object-cover"
          />
        ) : null}
        <div className="flex flex-col gap-1">
          <p>{t('photos.confirmDeleteBody')}</p>
          {photo?.isCover ? (
            <p className="text-small text-warning-ink">{t('photos.confirmDeleteCover')}</p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
