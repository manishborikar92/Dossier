'use client';

import { useRef, type ReactNode } from 'react';
import { cx } from '@/lib/classes';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  badge?: ReactNode;
}

/** Accessible tab list (arrow keys move between tabs). Render the panel with `role="tabpanel"` and `id={tabPanelId(id)}`. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  return (
    <div className="border-line border-b">
      <div
        role="tablist"
        aria-label={label}
        className="-mb-px flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el;
            }}
            type="button"
            role="tab"
            id={tabId(t.id)}
            aria-selected={value === t.id}
            aria-controls={tabPanelId(t.id)}
            tabIndex={value === t.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
              onChange(next.id);
              refs.current[next.id]?.focus();
            }}
            className={cx(
              'flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
              value === t.id ? 'border-brand text-brand' : 'text-muted hover:text-ink border-transparent',
            )}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
    </div>
  );
}

export const tabId = (id: string) => `tab-${id}`;
export const tabPanelId = (id: string) => `panel-${id}`;
