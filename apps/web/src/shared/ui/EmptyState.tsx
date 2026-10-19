import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Страницы уровня маршрута используют h1, блоки внутри страницы — h2. */
  titleAs?: 'h1' | 'h2';
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  titleAs = 'h2',
}: EmptyStateProps) {
  const Heading = titleAs;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 rounded-lg border border-border bg-surface px-6 py-10 text-center',
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-2 text-primary">
          {icon}
        </span>
      ) : null}

      <Heading className={titleAs === 'h1' ? 'text-h1 text-ink' : 'text-h3 text-ink'}>
        {title}
      </Heading>

      {description ? <p className="max-w-prose text-small text-ink-muted">{description}</p> : null}

      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
