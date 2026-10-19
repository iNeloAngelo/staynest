import type { ListingStatus } from '@staynest/shared';
import { Archive, CheckCircle2, CircleDashed } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { Badge } from '../../../shared/ui';

const STATUS_MAP: Record<
  ListingStatus,
  { tone: 'neutral' | 'success' | 'warning'; labelKey: TranslationKey }
> = {
  draft: { tone: 'neutral', labelKey: 'listings.status.draft' },
  published: { tone: 'success', labelKey: 'listings.status.published' },
  archived: { tone: 'neutral', labelKey: 'listings.status.archived' },
};

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  const { t } = useTranslation();
  const meta = STATUS_MAP[status];

  const Icon =
    status === 'published' ? CheckCircle2 : status === 'archived' ? Archive : CircleDashed;

  return (
    <Badge tone={meta.tone} icon={<Icon className="size-3.5" aria-hidden="true" />}>
      {t(meta.labelKey)}
    </Badge>
  );
}
