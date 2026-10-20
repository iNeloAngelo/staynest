import type { PublicListing } from '@staynest/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookingPanel } from '../../booking';
import { BottomSheet } from '../../../shared/ui/BottomSheet';
import { MobilePriceBar, PriceBlock } from './ListingDetailsSections';

export function BookingAside({ listing }: { listing: PublicListing }) {
  return (
    <div id="booking">
      <PriceBlock listing={listing} className="hidden lg:block">
        <BookingPanel key={listing.id} listing={listing} />
      </PriceBlock>
    </div>
  );
}

export function MobileBooking({ listing }: { listing: PublicListing }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const openBooking = () => setOpen(true);
    window.addEventListener('staynest:open-booking', openBooking);
    return () => window.removeEventListener('staynest:open-booking', openBooking);
  }, []);

  return (
    <>
      <div data-telegram-hide="true">
        <MobilePriceBar listing={listing} onOpen={() => setOpen(true)} />
      </div>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('booking.title')} fullHeight>
        <BookingPanel key={listing.id} listing={listing} heading={false} />
      </BottomSheet>
    </>
  );
}
