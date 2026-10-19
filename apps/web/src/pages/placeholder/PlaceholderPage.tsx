import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../shared/i18n';
import { EmptyState } from '../../shared/ui';

export type PlaceholderPageProps = {
  icon: LucideIcon;
  titleKey: TranslationKey;
  emptyTitleKey: TranslationKey;
  emptyBodyKey: TranslationKey;
};

export function PlaceholderPage({
  icon: Icon,
  titleKey,
  emptyTitleKey,
  emptyBodyKey,
}: PlaceholderPageProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h1 text-ink">{t(titleKey)}</h1>

      <EmptyState
        icon={<Icon className="size-6" aria-hidden="true" />}
        title={t(emptyTitleKey)}
        description={t(emptyBodyKey)}
      />
    </div>
  );
}
