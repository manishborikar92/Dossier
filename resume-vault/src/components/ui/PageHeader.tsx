import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

export interface Crumb {
  label: string;
  href?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
  meta,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: Crumb[];
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {crumbs && crumbs.length > 0 ? (
        <nav aria-label="Breadcrumb" className="text-muted mb-2 flex flex-wrap items-center gap-1 text-[13px]">
          {crumbs.map((c, i) => (
            <span key={c.label} className="inline-flex items-center gap-1">
              {c.href ? (
                <Link href={c.href} className="hover:text-brand font-medium">
                  {c.label}
                </Link>
              ) : (
                <span aria-current="page">{c.label}</span>
              )}
              {i < crumbs.length - 1 ? <ChevronRight className="size-3.5" aria-hidden /> : null}
            </span>
          ))}
        </nav>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-2xl">
          <h1 className="text-ink text-[1.65rem] leading-tight font-semibold tracking-tight break-words">{title}</h1>
          {description ? <p className="text-muted mt-1.5 text-[15px]">{description}</p> : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-1.5">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
