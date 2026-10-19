import { useTranslation } from 'react-i18next';
import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { FieldShell, fieldClassName } from './Field';

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  id?: string;
  label: string;
  hint?: string;
  error?: string;
  currentLength?: number;
  showCounter?: boolean;
};

export function Textarea({
  id,
  label,
  hint,
  error,
  currentLength,
  showCounter = false,
  className,
  maxLength,
  ...rest
}: TextareaProps) {
  const { t } = useTranslation();
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const counter =
    showCounter && maxLength
      ? t('ui.inputCounter', { current: currentLength ?? 0, max: maxLength })
      : undefined;

  return (
    <FieldShell
      id={textareaId}
      label={label}
      hint={hint}
      error={error}
      {...(counter ? { counter } : {})}
    >
      {({ describedBy, invalid }) => (
        <textarea
          id={textareaId}
          maxLength={maxLength}
          className={fieldClassName({
            invalid,
            extra: cn('min-h-28 resize-y py-2.5', className),
          })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  );
}
