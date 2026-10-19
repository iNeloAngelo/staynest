import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { FieldShell, fieldClassName } from './Field';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  suffix?: ReactNode;
};

export function Input({ id, label, hint, error, suffix, className, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <FieldShell id={inputId} label={label} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <div className="relative">
          <input
            id={inputId}
            className={fieldClassName({
              invalid,
              extra: cn('h-11', suffix ? 'pr-12' : undefined, className),
            })}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...rest}
          />

          {suffix ? (
            <span className="absolute inset-y-0 right-1 flex items-center">{suffix}</span>
          ) : null}
        </div>
      )}
    </FieldShell>
  );
}
