import { Share } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BottomSheet, Button } from '../../../shared/ui';

type IosInstallSheetProps = {
  open: boolean;
  onClose: () => void;
};

export function IosInstallSheet({ open, onClose }: IosInstallSheetProps) {
  const { t } = useTranslation();

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t('pwa.install.iosTitle')}
      footer={
        <Button fullWidth onClick={onClose}>
          {t('pwa.install.iosClose')}
        </Button>
      }
    >
      <ol className="flex flex-col gap-3 text-small text-ink">
        <li className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-semibold">
            1
          </span>
          <span className="flex items-center gap-2">
            <Share className="size-4 shrink-0" aria-hidden="true" />
            {t('pwa.install.iosStep1')}
          </span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-semibold">
            2
          </span>
          <span>{t('pwa.install.iosStep2')}</span>
        </li>
        <li className="flex gap-3">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-caption font-semibold">
            3
          </span>
          <span>{t('pwa.install.iosStep3')}</span>
        </li>
      </ol>

      <p className="mt-4 text-caption text-ink-muted">{t('pwa.install.iosNote')}</p>
    </BottomSheet>
  );
}
