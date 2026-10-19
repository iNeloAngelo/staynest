import { cn } from '../lib/cn';

type ModeSwitchOption = {
  value: string;
  label: string;
};

export type ModeSwitchProps = {
  label: string;
  value: string;
  options: [ModeSwitchOption, ModeSwitchOption];
  onChange: (value: string) => void;
  fullWidth?: boolean;
  className?: string;
};

export function ModeSwitch({
  label,
  value,
  options,
  onChange,
  fullWidth = false,
  className,
}: ModeSwitchProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex rounded-full bg-surface-2 p-1',
        fullWidth ? 'w-full' : 'w-fit',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-11 flex-1 rounded-full px-3 text-small font-semibold whitespace-nowrap',
              'transition-colors duration-micro',
              selected ? 'bg-surface text-primary shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
