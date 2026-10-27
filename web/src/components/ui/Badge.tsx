import type { ReactNode } from 'react';
import { cx } from '@/lib/classes';

const TONES = {
  neutral: 'bg-sunken text-ink-2 ring-line',
  brand: 'bg-brand-soft text-brand ring-brand-line',
  ok: 'bg-ok-soft text-ok ring-ok/20',
  warn: 'bg-warn-soft text-warn ring-warn/20',
  bad: 'bg-bad-soft text-bad ring-bad/20',
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = 'neutral',
  children,
  title,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      title={title}
      className={cx(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
