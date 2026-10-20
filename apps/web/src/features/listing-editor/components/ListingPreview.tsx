import { House } from 'lucide-react';
import type { TFunction } from 'i18next';
import type { ListingPhotoDto, ListingType } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import type { TranslationKey } from '../../../shared/i18n';
import { useLocale } from '../../../shared/i18n';
import { formatMoney, inputToMinor } from '../../../shared/lib/format';
import type { ListingFormState } from '../model/form';

const TYPE_KEYS: Record<ListingType, TranslationKey> = {
  house: 'listings.type.house',
  cottage: 'listings.type.cottage',
  cabin: 'listings.type.cabin',
  villa: 'listings.type.villa',
  townhouse: 'listings.type.townhouse',
};

function Cover({ photos, title }: { photos: ListingPhotoDto[]; title: string }) {
  const cover = photos.find((photo) => photo.isCover) ?? photos[0];

  if (!cover) {
    return (
      <span className="flex aspect-[4/3] items-center justify-center bg-surface-2 text-ink-muted">
        <House className="size-10" aria-hidden="true" strokeWidth={1.5} />
      </span>
    );
  }

  return (
    <img
      src={cover.urls.md}
      alt={title}
      width={cover.width}
      height={cover.height}
      className="aspect-[4/3] w-full object-cover"
    />
  );
}

function capacityLine(t: TFunction, state: ListingFormState): string {
  const parts: string[] = [];
  if (state.maxGuests.trim()) {
    parts.push(t('listings.wizard.preview.guests', { count: state.maxGuests }));
  }
  if (state.bedrooms.trim()) {
    parts.push(t('listings.wizard.preview.bedrooms', { count: state.bedrooms }));
  }
  if (state.beds.trim()) {
    parts.push(t('listings.wizard.preview.beds', { count: state.beds }));
  }
  return parts.join(' · ');
}

export function ListingPreview({
  state,
  photos,
  currency,
}: {
  state: ListingFormState;
  photos: ListingPhotoDto[];
  currency: string;
}) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const title = state.title.trim() || t('listings.untitled');
  const city = state.city.trim() || t('listings.noCity');
  const price = state.basePrice ? inputToMinor(state.basePrice) : null;
  const capacity = capacityLine(t, state);

  return (
    <section
      aria-labelledby="listing-preview-title"
      className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6"
    >
      <h2 id="listing-preview-title" className="font-serif text-h3 text-ink">
        {t('listings.wizard.preview.title')}
      </h2>
      <p className="text-small text-ink-muted">{t('listings.wizard.preview.body')}</p>

      <article className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
        <Cover photos={photos} title={title} />
        <div className="flex flex-col gap-1 p-4">
          <h3 className="line-clamp-2 text-body font-semibold text-ink">{title}</h3>
          <p className="text-small text-ink-muted">
            {city} · {t(TYPE_KEYS[state.type])}
          </p>
          {capacity ? <p className="text-small text-ink-muted">{capacity}</p> : null}
          <p className="mt-2 text-body font-semibold text-ink">
            {price !== null && Number.isFinite(price) && price > 0
              ? t('listings.perNight', { price: formatMoney(price, locale, currency) })
              : t('listings.wizard.preview.noPrice')}
          </p>
        </div>
      </article>
    </section>
  );
}
