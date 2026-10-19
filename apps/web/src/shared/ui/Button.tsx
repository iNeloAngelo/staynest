import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { buttonClassName } from './buttonStyles';
import type { ButtonSize, ButtonVariant } from './buttonStyles';

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClassName({ variant, size, fullWidth, ...(className ? { className } : {}) })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        </span>
      ) : null}

      <span
        className={
          loading ? 'inline-flex items-center gap-2 opacity-0' : 'inline-flex items-center gap-2'
        }
      >
        {leftIcon}
        {children}
        {rightIcon}
      </span>
    </button>
  );
}
