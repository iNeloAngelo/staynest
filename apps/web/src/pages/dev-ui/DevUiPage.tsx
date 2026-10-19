import { useTranslation } from 'react-i18next';
import { ButtonsSection } from './sections/ButtonsSection';
import { DataSection } from './sections/DataSection';
import { DiagnosticsSection } from './sections/DiagnosticsSection';
import { FeedbackSection } from './sections/FeedbackSection';
import { FormsSection } from './sections/FormsSection';
import { NavigationSection } from './sections/NavigationSection';

export default function DevUiPage() {
  const { t } = useTranslation();

  return (
    <article className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-h1 text-ink">{t('dev.title')}</h1>
        <p className="max-w-prose text-small text-ink-muted">{t('dev.subtitle')}</p>
      </header>

      <ButtonsSection />
      <FormsSection />
      <DataSection />
      <FeedbackSection />
      <NavigationSection />
      <DiagnosticsSection />
    </article>
  );
}
