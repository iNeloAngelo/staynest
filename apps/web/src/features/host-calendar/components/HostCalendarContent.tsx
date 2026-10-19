import type { HostCalendarResponse, ListingDto } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import type { IsoRange } from '../../booking/model/selection';
import { Select } from '../../../shared/ui/Select';
import { BlocksPanel } from './BlocksPanel';
import { HostCalendarSection } from './HostCalendarSection';
import { PriceRulesPanel } from './PriceRulesPanel';
import { PricesForm } from './PricesForm';

function listingOptions(listings: ListingDto[]): { value: string; label: string }[] {
  return listings.map((listing) => ({
    value: listing.id,
    label: listing.title ?? listing.city ?? listing.id,
  }));
}

function HostCalendarHeader({
  listings,
  listing,
  online,
  onListingChange,
}: {
  listings: ListingDto[];
  listing: ListingDto;
  online: boolean;
  onListingChange: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <>
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-h1 text-ink">{t('hostCalendar.title')}</h1>
          <p className="mt-1 text-small text-ink-muted">{t('hostCalendar.subtitle')}</p>
        </div>
        <Select
          label={t('hostCalendar.selectListing')}
          value={listing.id}
          options={listingOptions(listings)}
          onChange={(event) => onListingChange(event.target.value)}
        />
      </header>

      {!online ? (
        <p
          role="status"
          className="rounded-md border border-warning/40 bg-warning/10 px-4 py-3 text-small text-warning-ink"
        >
          {t('hostCalendar.offline')}
        </p>
      ) : null}
    </>
  );
}

export function HostCalendarContent({
  listings,
  listing,
  calendar,
  online,
  month,
  range,
  notice,
  onListingChange,
  onMonthChange,
  onSelect,
}: {
  listings: ListingDto[];
  listing: ListingDto;
  calendar: HostCalendarResponse;
  online: boolean;
  month: Date;
  range: IsoRange | undefined;
  notice: string | null;
  onListingChange: (id: string) => void;
  onMonthChange: (month: Date) => void;
  onSelect: (date: Date) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <HostCalendarHeader
        listings={listings}
        listing={listing}
        online={online}
        onListingChange={onListingChange}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <div className="flex flex-col gap-6">
          <HostCalendarSection
            calendar={calendar}
            month={month}
            range={range}
            notice={notice}
            onMonthChange={onMonthChange}
            onSelect={onSelect}
          />
          <BlocksPanel listingId={listing.id} blocks={calendar.blocks} online={online} />
        </div>

        <div className="flex flex-col gap-6">
          <PricesForm key={listing.id} listing={listing} online={online} />
          <PriceRulesPanel listingId={listing.id} currency={listing.currency} online={online} />
        </div>
      </div>
    </div>
  );
}
