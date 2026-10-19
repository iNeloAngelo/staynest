import type { ClassNames, ModifiersClassNames } from 'react-day-picker';

/**
 * Календарь react-day-picker без внешнего CSS: все элементы оформлены
 * токенами DESIGN.md. Классы `day`/`range_*` вешаются на ячейку, поэтому
 * оформление кнопки идёт через `[&>button]`.
 */
export const calendarClassNames: Partial<ClassNames> = {
  root: 'relative w-full',
  months: 'flex flex-col gap-4',
  month: 'w-full',
  month_caption: 'flex min-h-11 items-center justify-center px-12',
  caption_label: 'text-h3 font-semibold text-ink',
  nav: 'absolute inset-x-0 top-0 flex items-center justify-between',
  button_previous:
    'inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40',
  button_next:
    'inline-flex size-11 items-center justify-center rounded-md text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-40',
  chevron: 'size-5',
  month_grid: 'w-full border-collapse',
  weekdays: '',
  weekday: 'pb-2 text-caption font-medium text-ink-muted',
  week: '',
  day: 'p-0 text-center align-middle',
  day_button:
    'mx-auto flex size-11 items-center justify-center rounded-full text-small text-ink transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:hover:bg-transparent',
  selected: '[&>button]:bg-accent [&>button]:font-semibold [&>button]:text-on-accent',
  range_start:
    '[&>button]:rounded-r-none [&>button]:bg-accent [&>button]:font-semibold [&>button]:text-on-accent',
  range_end:
    '[&>button]:rounded-l-none [&>button]:bg-accent [&>button]:font-semibold [&>button]:text-on-accent',
  range_middle: '[&>button]:rounded-none [&>button]:bg-accent/20 [&>button]:text-ink',
  today: '[&>button]:ring-1 [&>button]:ring-primary',
  outside: 'opacity-40',
  disabled: '[&>button]:text-ink-muted [&>button]:hover:bg-transparent',
  hidden: 'invisible',
  footer: 'mt-3 min-h-5 text-small text-ink-muted',
};

export const calendarModifiersClassNames: ModifiersClassNames = {
  booked: '[&>button]:text-ink-muted [&>button]:line-through [&>button]:decoration-ink-muted',
  blocked: '[&>button]:text-ink-muted [&>button]:line-through [&>button]:decoration-ink-muted',
};
