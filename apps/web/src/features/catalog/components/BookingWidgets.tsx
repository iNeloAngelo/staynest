import type { PublicListing } from '@staynest/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookingPanel } from '../../booking';
import { BottomSheet } from '../../../shared/ui/BottomSheet';
import { MobilePriceBar, PriceBlock } from './ListingDetailsSections';

export function BookingAside({ listing }: { listing: PublicListing }) {
  return (
    <PriceBlock listing={listing} className="hidden lg:block">
      <BookingPanel key={listing.id} listing={listing} />
    </PriceBlock>
  );
}

export function MobileBooking({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <>
      <MobilePriceBar listing={listing} onOpen={() => setOpen(true)} />
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('booking.title')} fullHeight>
        <BookingPanel key={listing.id} listing={listing} heading={false} />
      </BottomSheet>
    </>
  );
}
