import { ChevronDown } from 'lucide-react';
import { useId } from 'react';
import type { SelectHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { FieldShell, fieldClassName } from './Field';

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'children'> & {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  options: SelectOption[];
};

export function Select({
  id,
  label,
  hint,
  error,
  placeholder,
  options,
  className,
  ...rest
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const emptyValue = Boolean(placeholder && !rest.value && !rest.defaultValue);

  return (
    <FieldShell id={selectId} label={label} hint={hint} error={error}>
      {({ describedBy, invalid }) => (
        <div className="relative">
          <select
            id={selectId}
            className={fieldClassName({
              invalid,
              extra: cn('h-11 appearance-none pr-10', className),
            })}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            {...rest}
          >
            {placeholder ? (
              <option value="" disabled={emptyValue}>
                {placeholder}
              </option>
            ) : null}

            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown
            className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
        </div>
      )}
    </FieldShell>
  );
}
