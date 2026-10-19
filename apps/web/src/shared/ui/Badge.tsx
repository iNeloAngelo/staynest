import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-2 text-ink-muted',
  success: 'bg-success/12 text-success-ink',
  warning: 'bg-warning/14 text-warning-ink',
  danger: 'bg-danger/12 text-danger',
  info: 'bg-info/12 text-info',
};

export type BadgeProps = {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Badge({ tone = 'neutral', icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-caption font-semibold',
        TONES[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
