import { Check } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  children: ReactNode;
};

export function Chip({
  selected = false,
  className,
  children,
  type = 'button',
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-small font-medium',
        'transition-colors duration-micro',
        'disabled:cursor-not-allowed disabled:opacity-50',
        selected
          ? 'border-primary bg-primary text-on-primary'
          : 'border-border-strong bg-surface text-ink hover:border-primary',
        className,
      )}
      {...rest}
    >
      {selected ? <Check className="size-4" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
