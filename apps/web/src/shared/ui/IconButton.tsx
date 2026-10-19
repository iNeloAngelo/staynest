import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

const TONES = {
  ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
  primary: 'bg-primary text-on-primary hover:bg-primary-hover',
  danger: 'text-danger hover:bg-danger/10',
} as const;

export type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> & {
  /** Обязательная подпись: иконка без текста недоступна скринридеру. */
  label: string;
  tone?: keyof typeof TONES;
  children: ReactNode;
};

export function IconButton({
  label,
  tone = 'ghost',
  className,
  children,
  type = 'button',
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-md',
        'transition-colors duration-micro',
        'disabled:cursor-not-allowed disabled:opacity-50',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
