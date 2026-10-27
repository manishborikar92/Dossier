'use client';

import { useMemo, type ReactNode } from 'react';
import { useHeader, type Crumb } from '../layout/HeaderContext';

export type { Crumb };

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
  const resolvedCrumbs = useMemo(() => crumbs ?? [{ label: title }], [crumbs, title]);

  // Register breadcrumbs and top-right actions into the layout Header
  useHeader({
    crumbs: resolvedCrumbs,
    actions,
    title,
  });

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-ink text-2xl sm:text-[1.75rem] leading-tight font-bold tracking-tight break-words">{title}</h1>
          {description ? <p className="text-muted mt-1.5 text-sm sm:text-[15px] leading-relaxed">{description}</p> : null}
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {/* On very small mobile screens (<640px), keep actions accessible inline as well */}
        {actions ? <div className="flex flex-wrap items-center gap-2 sm:hidden w-full pt-1">{actions}</div> : null}
      </div>
    </div>
  );
}
