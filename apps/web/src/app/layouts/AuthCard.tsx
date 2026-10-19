import type { ReactNode } from 'react';

export type AuthCardProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-h1 text-ink">{title}</h1>
        <p className="text-small text-ink-muted">{subtitle}</p>
      </div>

      {children}
    </section>
  );
}
