import { AlertCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { fieldAnchor } from '../model/errors';

type AlertIssue = {
  field: string;
  message: string;
};

type Props = {
  title: string;
  issues: AlertIssue[];
  /** В мастере ссылка переключает шаг, а не просто скроллит к якорю. */
  onFieldSelect?: (field: string) => void;
};

export function ListingIssuesAlert({ title, issues, onFieldSelect }: Props) {
  const alertRef = useRef<HTMLDivElement>(null);
  const hadIssues = useRef(false);

  useEffect(() => {
    if (issues.length > 0 && !hadIssues.current) alertRef.current?.focus();
    hadIssues.current = issues.length > 0;
  }, [issues.length]);

  if (issues.length === 0) return null;

  return (
    <div
      ref={alertRef}
      tabIndex={-1}
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-danger/10 p-4"
    >
      <p className="flex items-center gap-2 text-body font-semibold text-danger">
        <AlertCircle className="size-5 shrink-0" aria-hidden="true" />
        {title}
      </p>

      <ul className="flex list-disc flex-col gap-1 pl-6 text-small text-ink">
        {issues.map((item) => {
          const anchor = fieldAnchor(item.field);
          const canJump = onFieldSelect ? true : Boolean(anchor);

          return (
            <li key={`${item.field}-${item.message}`}>
              {canJump ? (
                onFieldSelect ? (
                  <button
                    type="button"
                    className="text-left underline underline-offset-2"
                    onClick={() => onFieldSelect(item.field)}
                  >
                    {item.message}
                  </button>
                ) : anchor ? (
                  <a href={`#${anchor}`} className="underline underline-offset-2">
                    {item.message}
                  </a>
                ) : (
                  item.message
                )
              ) : (
                item.message
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
