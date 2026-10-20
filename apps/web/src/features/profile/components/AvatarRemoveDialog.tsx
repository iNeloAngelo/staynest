import { useTranslation } from 'react-i18next';
import { Button, Modal } from '../../../shared/ui';

type AvatarRemoveDialogProps = {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function AvatarRemoveDialog({ open, pending, onClose, onConfirm }: AvatarRemoveDialogProps) {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('profile.avatarRemove')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={pending}>
            {t('profile.avatarRemove')}
          </Button>
        </>
      }
    >
      <p>{t('profile.avatarRemoveBody')}</p>
    </Modal>
  );
}
