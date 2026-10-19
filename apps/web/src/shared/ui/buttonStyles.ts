import { cn } from '../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover active:bg-primary-hover',
  secondary:
    'border border-border-strong bg-surface text-ink hover:border-primary hover:text-primary',
  ghost: 'bg-transparent text-ink hover:bg-surface-2 active:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-90 active:brightness-90',
};

const SIZES: Record<ButtonSize, string> = {
  md: 'h-11 px-4 text-small',
  lg: 'h-13 px-6 text-body',
};

export function buttonClassName({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    'relative inline-flex items-center justify-center gap-2 rounded-md font-semibold',
    'transition-colors duration-micro',
    'disabled:cursor-not-allowed disabled:opacity-50',
    VARIANTS[variant],
    SIZES[size],
    fullWidth && 'w-full',
    className,
  );
}
