import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/cn';
import { IconButton } from './IconButton';

export type NumberStepperProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
};

export function NumberStepper({
  label,
  value,
  min = 0,
  max = 99,
  step = 1,
  hint,
  disabled = false,
  onChange,
}: NumberStepperProps) {
  const { t } = useTranslation();
  const labelId = useId();
  const hintId = useId();
  const decreaseDisabled = disabled || value <= min;
  const increaseDisabled = disabled || value >= max;

  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-small font-medium text-ink">
        {label}
      </span>

      <div
        role="group"
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        className={cn(
          'inline-flex w-fit items-center gap-1 rounded-md border border-border bg-surface p-1',
          disabled && 'opacity-50',
        )}
      >
        <IconButton
          label={t('common.decrease')}
          disabled={decreaseDisabled}
          onClick={() => onChange(Math.max(min, value - step))}
        >
          <Minus className="size-5" aria-hidden="true" />
        </IconButton>

        <output
          className="min-w-11 text-center text-body font-semibold text-ink tabular-nums"
          aria-live="polite"
        >
          {value}
        </output>

        <IconButton
          label={t('common.increase')}
          disabled={increaseDisabled}
          onClick={() => onChange(Math.min(max, value + step))}
        >
          <Plus className="size-5" aria-hidden="true" />
        </IconButton>
      </div>

      {hint ? (
        <p id={hintId} className="text-small text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
