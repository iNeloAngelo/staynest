import { useTranslation } from 'react-i18next';
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

  return (
    <ModeSwitch
      label={t('mode.label')}
      value={mode}
      options={[
        { value: 'guest', label: t('mode.guest') },
        { value: 'host', label: t('mode.host') },
      ]}
      onChange={(value) => setMode(value as AppMode)}
      fullWidth={fullWidth}
      className={className}
    />
  );
}
