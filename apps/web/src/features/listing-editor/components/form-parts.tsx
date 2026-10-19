import type { ReactNode } from 'react';
import { Input } from '../../../shared/ui';
import type { ListingFormErrors, ListingFormState } from '../model/form';

export type SectionProps = {
  state: ListingFormState;
  setField: <K extends keyof ListingFormState>(field: K, value: ListingFormState[K]) => void;
  errors: ListingFormErrors;
};

export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 shadow-sm sm:p-6">
      <h2 className="font-serif text-h3 text-ink">{title}</h2>
      {children}
    </section>
  );
}

export function NumberField({
  id,
  label,
  value,
  error,
  onChange,
  min = 0,
  max,
  step = 1,
  inputMode = 'numeric',
}: {
  id?: string;
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number | string;
  inputMode?: 'numeric' | 'decimal';
}) {
  return (
    <Input
      {...(id ? { id } : {})}
      type="number"
      inputMode={inputMode}
      min={min}
      {...(max !== undefined ? { max } : {})}
      step={step}
      label={label}
      error={error}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
