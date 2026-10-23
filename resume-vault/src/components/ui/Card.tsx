import type { ReactNode } from 'react';
import { cx } from '@/lib/classes';

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article';
}) {
  return <Tag className={cx('border-line bg-surface shadow-card rounded-xl border', className)}>{children}</Tag>;
}

/** A titled card: heading, optional description and action, then its content. */
export function SectionCard({
  id,
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cx('border-line bg-surface shadow-card scroll-mt-6 rounded-xl border', className)}
    >
      <header className="border-line flex flex-wrap items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 id={headingId} className="text-ink text-base font-semibold tracking-tight">
            {title}
          </h2>
          {description ? <p className="text-muted mt-0.5 max-w-2xl text-sm">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </header>
      <div className={bodyClassName ?? 'px-5 py-4'}>{children}</div>
    </section>
  );
}
