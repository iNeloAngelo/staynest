import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { ModeSwitch } from '../../../shared/ui/ModeSwitch';
import { useMode } from '../model/ModeProvider';
import type { AppMode } from '../model/ModeProvider';

export type ModeSwitchControlProps = {
  fullWidth?: boolean;
  className?: string;
};

export function ModeSwitchControl({ fullWidth = false, className }: ModeSwitchControlProps) {
  const { t } = useTranslation();
  const { mode, setMode } = useMode();
  const location = useLocation();
  const navigate = useNavigate();

  function onChange(value: AppMode): void {
    setMode(value);
    // На host-маршруте гостевая навигация недоступна: уводим на главную,
    // иначе переключатель выглядит сломанным.
    if (value === 'guest' && location.pathname.startsWith('/host')) navigate('/');
  }

  return (
    <ModeSwitch
      label={t('mode.label')}
      value={mode}
      options={[
        { value: 'guest', label: t('mode.guest') },
        { value: 'host', label: t('mode.host') },
      ]}
      onChange={(value) => onChange(value as AppMode)}
      fullWidth={fullWidth}
      className={className}
    />
  );
}
