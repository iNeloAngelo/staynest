import type { BookingStatus } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../../shared/ui';
import { statusMeta } from '../model/status';

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { t } = useTranslation();
  const { tone, icon: Icon, labelKey } = statusMeta(status);

  return (
    <Badge tone={tone} icon={<Icon className="size-3.5" aria-hidden="true" strokeWidth={1.75} />}>
      {t(labelKey)}
    </Badge>
  );
}
