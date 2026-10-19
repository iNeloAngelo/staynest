import type { AmenityDto, PublicListing } from '@staynest/shared';
import type { LucideIcon } from 'lucide-react';
import {
  AirVent,
  Baby,
  Bath,
  BedDouble,
  Car,
  CookingPot,
  Droplets,
  Flame,
  MapPin,
  Mountain,
  PawPrint,
  Ruler,
  Sparkles,
  Tv,
  Users,
  UtensilsCrossed,
  WashingMachine,
  Waves,
  Wifi,
} from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '../../../shared/i18n';
import { formatMoney } from '../../../shared/lib/format';
import { Button } from '../../../shared/ui/Button';
import { Skeleton, SkeletonText } from '../../../shared/ui/Skeleton';

const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  sauna: Flame,
  parking: Car,
  fireplace: Flame,
  pets_allowed: PawPrint,
  pool: Waves,
  bbq: CookingPot,
  kitchen: UtensilsCrossed,
  washer: WashingMachine,
  ac: AirVent,
  tv: Tv,
  kids_friendly: Baby,
  lake_view: Droplets,
  mountain_view: Mountain,
};

export function DetailsSkeleton() {
  const { t } = useTranslation();

  return (
    <div role="status" className="flex flex-col gap-6" aria-busy="true">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-9 w-3/4" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="aspect-[4/3] w-full rounded-lg lg:aspect-[16/10]" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <SkeletonText lines={8} />
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    </div>
  );
}

export function Facts({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();

  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-small text-ink-muted">
      <li className="inline-flex items-center gap-1.5">
        <Users className="size-4" aria-hidden="true" />
        {t('listing.facts.guests', { count: listing.maxGuests })}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <BedDouble className="size-4" aria-hidden="true" />
        {t('listing.facts.bedrooms', { count: listing.bedrooms })}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <BedDouble className="size-4" aria-hidden="true" />
        {t('listing.facts.beds', { count: listing.beds })}
      </li>
      <li className="inline-flex items-center gap-1.5">
        <Bath className="size-4" aria-hidden="true" />
        {t('listing.facts.bathrooms', { count: listing.bathrooms })}
      </li>
      {listing.areaSqm !== null ? (
        <li className="inline-flex items-center gap-1.5">
          <Ruler className="size-4" aria-hidden="true" />
          {t('listing.facts.area', { area: listing.areaSqm })}
        </li>
      ) : null}
    </ul>
  );
}

export function Description({ text }: { text: string }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const long = text.length > 420;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h2 text-ink">{t('listing.about')}</h2>
      <p
        id={textId}
        className={`max-w-prose whitespace-pre-line text-body text-ink ${long && !expanded ? 'line-clamp-6' : ''}`}
      >
        {text}
      </p>
      {long ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={textId}
          className="inline-flex min-h-11 items-center self-start text-small font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? t('listing.descriptionCollapse') : t('listing.descriptionExpand')}
        </button>
      ) : null}
    </section>
  );
}

function amenitiesWithNames(amenities: AmenityDto[], language: string) {
  return amenities.map((amenity) => ({
    ...amenity,
    name: language.startsWith('en') ? amenity.nameEn : amenity.nameRu,
    Icon: AMENITY_ICONS[amenity.code] ?? Sparkles,
  }));
}

export function Amenities({ amenities }: { amenities: AmenityDto[] }) {
  const { t, i18n } = useTranslation();
  const items = amenitiesWithNames(amenities, i18n.language);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h2 text-ink">{t('listing.amenities')}</h2>
      {items.length === 0 ? (
        <p className="text-body text-ink-muted">{t('listing.amenitiesEmpty')}</p>
      ) : (
        <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {items.map(({ id, name, Icon }) => (
            <li key={id} className="flex items-center gap-2 text-body text-ink">
              <Icon
                className="size-5 shrink-0 text-primary"
                aria-hidden="true"
                strokeWidth={1.75}
              />
              {name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LocationSection({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();
  const hasCoordinates = listing.approxLat !== null && listing.approxLng !== null;
  const mapUrl = hasCoordinates
    ? `https://www.openstreetmap.org/?mlat=${listing.approxLat}&mlon=${listing.approxLng}#map=12/${listing.approxLat}/${listing.approxLng}`
    : null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-h2 text-ink">{t('listing.location')}</h2>
      <p className="max-w-prose text-body text-ink">
        {[listing.city, listing.region, listing.country].filter(Boolean).join(', ')}
      </p>
      <p className="text-small text-ink-muted">{t('listing.locationNote')}</p>
      {mapUrl ? (
        <a
          href={mapUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-2 text-small font-semibold text-primary underline-offset-4 hover:underline"
        >
          <MapPin className="size-4" aria-hidden="true" />
          {t('listing.locationMap')}
        </a>
      ) : null}
    </section>
  );
}

export function PriceBlock({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const price = formatMoney(listing.basePriceMinor, locale, listing.currency);
  const weekend =
    listing.weekendPriceMinor === null
      ? null
      : formatMoney(listing.weekendPriceMinor, locale, listing.currency);
  const cleaning = formatMoney(listing.cleaningFeeMinor, locale, listing.currency);

  return (
    <aside className="h-fit rounded-lg border border-border bg-surface p-5 shadow-md lg:sticky lg:top-24">
      <p className="text-body text-ink-muted">
        {t('listing.price.from')} <span className="text-h1 font-semibold text-ink">{price}</span>{' '}
        {t('listing.price.perNight')}
      </p>

      <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-small text-ink-muted">
        {weekend ? (
          <div className="flex justify-between gap-3">
            <dt>{t('listing.price.weekend')}</dt>
            <dd className="text-ink tabular-nums">{weekend}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt>{t('listing.price.cleaning')}</dt>
          <dd className="text-ink tabular-nums">{cleaning}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{t('listing.price.minNights')}</dt>
          <dd className="text-ink tabular-nums">{listing.minNights}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{t('listing.price.maxNights')}</dt>
          <dd className="text-ink tabular-nums">{listing.maxNights}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{t('listing.price.checkIn')}</dt>
          <dd className="text-ink tabular-nums">{listing.checkInTime}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>{t('listing.price.checkOut')}</dt>
          <dd className="text-ink tabular-nums">{listing.checkOutTime}</dd>
        </div>
      </dl>

      <Button fullWidth size="lg" className="mt-5" disabled aria-describedby="booking-soon">
        {t('listing.chooseDates')}
      </Button>
      <p id="booking-soon" className="mt-2 text-center text-caption text-ink-muted">
        {t('listing.bookingSoon')}
      </p>
    </aside>
  );
}

export function MobilePriceBar({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const price = formatMoney(listing.basePriceMinor, locale, listing.currency);

  return (
    <div className="fixed inset-x-0 bottom-nav z-30 flex items-center justify-between gap-3 border-t border-border bg-surface px-4 py-3 shadow-md lg:hidden">
      <p className="text-small text-ink-muted">
        {t('listing.price.from')}{' '}
        <span className="text-h3 font-semibold text-ink tabular-nums">{price}</span>
      </p>
      <Button disabled aria-describedby="booking-soon-mobile">
        {t('listing.chooseDates')}
      </Button>
      <span id="booking-soon-mobile" className="sr-only">
        {t('listing.bookingSoon')}
      </span>
    </div>
  );
}
