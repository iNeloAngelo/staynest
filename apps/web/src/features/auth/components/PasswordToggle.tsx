import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../../../shared/ui/IconButton';

export type PasswordToggleProps = {
  visible: boolean;
  onToggle: () => void;
};

export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  const { t } = useTranslation();
  const label = visible ? t('common.hidePassword') : t('common.showPassword');

  return (
    <IconButton label={label} onClick={onToggle} className="mr-0.5">
      {visible ? (
        <EyeOff className="size-5" aria-hidden="true" />
      ) : (
        <Eye className="size-5" aria-hidden="true" />
      )}
    </IconButton>
  );
}
