import type { ListingDto } from '@staynest/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUpdateListing } from '../../listings';
import { Button } from '../../../shared/ui/Button';
import { Input } from '../../../shared/ui/Input';
import { useToast } from '../../../shared/ui';
import { inputToMinor, minorToInput } from '../../../shared/lib/format';
import { hostErrorText } from '../model/errors';

type PriceValues = { base: string; weekend: string; cleaning: string };
type PriceField = keyof PriceValues;

function valuesFrom(listing: ListingDto): PriceValues {
  return {
    base: minorToInput(listing.basePriceMinor),
    weekend: minorToInput(listing.weekendPriceMinor),
    cleaning: minorToInput(listing.cleaningFeeMinor),
  };
}

function PriceFields({
  values,
  onChange,
}: {
  values: PriceValues;
  onChange: (field: PriceField, value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4">
      <Input
        label={t('hostCalendar.basePrice')}
        inputMode="decimal"
        value={values.base}
        onChange={(event) => onChange('base', event.target.value)}
      />
      <Input
        label={t('hostCalendar.weekendPrice')}
        hint={t('hostCalendar.weekendPriceHint')}
        inputMode="decimal"
        value={values.weekend}
        onChange={(event) => onChange('weekend', event.target.value)}
      />
      <Input
        label={t('hostCalendar.cleaningFee')}
        inputMode="decimal"
        value={values.cleaning}
        onChange={(event) => onChange('cleaning', event.target.value)}
      />
    </div>
  );
}

export function PricesForm({ listing, online }: { listing: ListingDto; online: boolean }) {
  const { t } = useTranslation();
  const toast = useToast();
  const update = useUpdateListing(listing.id);
  const [values, setValues] = useState<PriceValues>(() => valuesFrom(listing));
  const [error, setError] = useState<string | null>(null);

  function change(field: PriceField, value: string): void {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function save(): Promise<void> {
    const base = inputToMinor(values.base);
    const weekend = inputToMinor(values.weekend);
    const cleaning = inputToMinor(values.cleaning);
    const weekendInvalid = values.weekend.trim() !== '' && (weekend === null || weekend <= 0);

    if (base === null || base <= 0 || cleaning === null || cleaning < 0 || weekendInvalid) {
      setError(t('hostCalendar.validation.prices'));
      return;
    }

    setError(null);

    try {
      await update.mutateAsync({
        basePriceMinor: base,
        weekendPriceMinor: weekend === null || weekend <= 0 ? null : weekend,
        cleaningFeeMinor: cleaning,
      });
      toast.show({ title: t('hostCalendar.priceSaved'), tone: 'success' });
    } catch (caught) {
      setError(hostErrorText(caught, t));
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-h3 text-ink">{t('hostCalendar.priceTitle')}</h2>
      <PriceFields values={values} onChange={change} />

      {error ? (
        <p role="alert" className="text-small text-danger">
          {error}
        </p>
      ) : null}

      <div>
        <Button
          onClick={() => void save()}
          loading={update.isPending}
          disabled={!online || update.isPending}
        >
          {t('hostCalendar.savePrice')}
        </Button>
      </div>
    </section>
  );
}
