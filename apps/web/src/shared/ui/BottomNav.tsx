import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '../lib/cn';

export type BottomNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
};

export type BottomNavProps = {
  items: BottomNavItem[];
  label: string;
  /** Встроенный вариант для витрины компонентов. */
  inline?: boolean;
};

export function BottomNav({ items, label, inline = false }: BottomNavProps) {
  return (
    <nav
      aria-label={label}
      data-telegram-hide={inline ? undefined : 'true'}
      className={cn(
        'border-t border-border bg-surface',
        inline ? 'rounded-lg' : 'fixed inset-x-0 bottom-0 z-40 pb-safe lg:hidden',
      )}
    >
      <ul className="mx-auto grid h-16 max-w-page grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-full flex-col items-center justify-center gap-0.5 px-1 text-small',
                    'transition-colors duration-micro',
                    isActive ? 'font-semibold text-primary' : 'text-ink-muted hover:text-ink',
                  )
                }
              >
                <Icon className="size-6" aria-hidden="true" strokeWidth={1.75} />
                <span>{item.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
