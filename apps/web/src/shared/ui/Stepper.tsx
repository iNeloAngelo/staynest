import { Check } from 'lucide-react';
import { cn } from '../lib/cn';

type StepperStep = {
  id: string;
  label: string;
};

export type StepperProps = {
  steps: StepperStep[];
  current: number;
  /** Наибольший шаг, до которого пользователь уже дошёл. */
  maxReached: number;
  label: string;
  onSelect: (index: number) => void;
};

function StepMark({ index, current }: { index: number; current: number }) {
  if (index < current) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-on-primary">
        <Check className="size-3.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full border text-caption font-semibold',
        index === current
          ? 'border-primary bg-primary text-on-primary'
          : 'border-border-strong bg-surface text-ink-muted',
      )}
    >
      {index + 1}
    </span>
  );
}

export function Stepper({ steps, current, maxReached, label, onSelect }: StepperProps) {
  return (
    <nav aria-label={label}>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {steps.map((step, index) => {
          const reachable = index <= maxReached;

          return (
            <li key={step.id} className="min-w-0">
              <button
                type="button"
                disabled={!reachable}
                aria-label={`${step.label}, ${index + 1}/${steps.length}`}
                aria-current={index === current ? 'step' : undefined}
                onClick={() => onSelect(index)}
                className={cn(
                  'flex min-h-11 w-full items-center gap-2 rounded-md border px-3 text-left text-small transition-colors duration-micro',
                  index === current
                    ? 'border-primary bg-primary/5 font-semibold text-primary'
                    : 'border-border bg-surface text-ink-muted hover:border-border-strong',
                  !reachable ? 'cursor-not-allowed opacity-60' : undefined,
                )}
              >
                <StepMark index={index} current={current} />
                <span className="hidden truncate sm:inline">{step.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
