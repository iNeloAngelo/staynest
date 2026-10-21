import { AlertCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  counter?: string;
  children: (ids: { describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

export function FieldShell({ id, label, hint, error, counter, children }: FieldShellProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [error ? undefined : hintId, errorId].filter(Boolean).join(' ') || undefined;
  const invalid = Boolean(error);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-small font-medium text-ink">
        {label}
      </label>

      {children({ describedBy, invalid })}

      {hint || error || counter ? (
        <div className="flex items-start justify-between gap-3">
          {error ? (
            <p id={errorId} role="alert" className="flex items-start gap-1 text-small text-danger">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </p>
          ) : hint ? (
            <p id={hintId} className="text-small text-ink-muted">
              {hint}
            </p>
          ) : (
            <span />
          )}

          {counter ? (
            <span className="shrink-0 text-caption text-ink-muted tabular-nums">{counter}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function fieldClassName({ invalid, extra }: { invalid: boolean; extra?: string }): string {
  return cn(
    'w-full max-w-full min-w-0 rounded-md border bg-surface px-3 text-body text-ink',
    'transition-colors duration-micro placeholder:text-ink-muted',
    'hover:border-ink-muted',
    'disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-muted',
    invalid ? 'border-danger' : 'border-border-strong',
    extra,
  );
}
