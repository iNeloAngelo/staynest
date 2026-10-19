import { ArrowRight, Heart, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from '../../../shared/ui';

export function ButtonsSection() {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="dev-buttons" className="flex flex-col gap-4">
      <h2 id="dev-buttons" className="text-h2 text-ink">
        {t('dev.section.buttons')}
      </h2>

      <div className="flex flex-col gap-6 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
        <div className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-ink">{t('dev.buttons.variants')}</h3>
          <div className="flex flex-wrap gap-2">
            <Button>{t('dev.buttons.primary')}</Button>
            <Button variant="secondary">{t('dev.buttons.secondary')}</Button>
            <Button variant="ghost">{t('dev.buttons.ghost')}</Button>
            <Button variant="danger">{t('dev.buttons.danger')}</Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-ink">{t('dev.buttons.sizes')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button>{t('dev.buttons.primary')}</Button>
            <Button size="lg">{t('dev.buttons.large')}</Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-ink">{t('dev.buttons.states')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button loading>{t('dev.buttons.loading')}</Button>
            <Button disabled>{t('dev.buttons.disabled')}</Button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h3 className="text-small font-semibold text-ink">{t('dev.buttons.withIcon')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Button leftIcon={<Plus className="size-5" aria-hidden="true" />}>
              {t('dev.buttons.primary')}
            </Button>
            <Button
              variant="secondary"
              rightIcon={<ArrowRight className="size-5" aria-hidden="true" />}
            >
              {t('dev.buttons.secondary')}
            </Button>
            <IconButton label={t('dev.buttons.iconButton')}>
              <Heart className="size-5" aria-hidden="true" />
            </IconButton>
          </div>
        </div>
      </div>
    </section>
  );
}
