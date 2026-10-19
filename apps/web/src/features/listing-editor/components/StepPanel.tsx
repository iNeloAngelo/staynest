import type { ListingDto } from '@staynest/shared';
import { useTranslation } from 'react-i18next';
import { PhotoUploader } from '../../photo-uploader';
import { AmenitiesSection, CapacitySection } from './FeatureSections';
import { ListingPreview } from './ListingPreview';
import { PriceSection, RulesSection, StaySection } from './PriceSections';
import { BasicsSection, LocationSection } from './BasicsSections';
import type { ListingWizardController } from '../model/useListingWizard';

function PhotoStep({
  controller,
  listing,
}: {
  controller: ListingWizardController;
  listing: ListingDto;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3">
      <PhotoUploader
        listingId={listing.id}
        photos={listing.photos}
        disabled={Boolean(controller.conflictDraft)}
      />
      {controller.photoCount < 3 ? (
        <p role="status" className="rounded-md bg-warning/10 px-4 py-3 text-small text-warning-ink">
          {t('listings.wizard.photosRequired')}
        </p>
      ) : null}
    </div>
  );
}

function PricingStep({
  controller,
  listing,
}: {
  controller: ListingWizardController;
  listing: ListingDto;
}) {
  const props = {
    state: controller.state,
    setField: controller.setField,
    errors: controller.errors,
  };

  return (
    <div className="flex flex-col gap-4">
      <PriceSection {...props} />
      <StaySection {...props} />
      <RulesSection {...props} />
      <ListingPreview
        state={controller.state}
        photos={listing.photos}
        currency={listing.currency}
      />
    </div>
  );
}

export function StepPanel({
  controller,
  listing,
}: {
  controller: ListingWizardController;
  listing: ListingDto;
}) {
  const props = {
    state: controller.state,
    setField: controller.setField,
    errors: controller.errors,
  };

  if (controller.step === 0) return <BasicsSection {...props} />;
  if (controller.step === 1) return <LocationSection {...props} />;
  if (controller.step === 2) {
    return (
      <div className="flex flex-col gap-4">
        <CapacitySection {...props} />
        <AmenitiesSection {...props} />
      </div>
    );
  }
  if (controller.step === 3) return <PhotoStep controller={controller} listing={listing} />;

  return <PricingStep controller={controller} listing={listing} />;
}
