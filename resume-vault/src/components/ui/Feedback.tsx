import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '@/lib/classes';

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="border-line-strong bg-surface rounded-xl border border-dashed px-6 py-12 text-center">
      {Icon ? (
        <span className="bg-brand-soft text-brand mx-auto mb-3 flex size-11 items-center justify-center rounded-full">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <p className="text-ink text-base font-semibold">{title}</p>
      {children ? <p className="text-muted mx-auto mt-1 max-w-md text-sm">{children}</p> : null}
      {action ? <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="text-muted inline-flex items-center gap-2 text-sm">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {label}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('bg-line/70 animate-pulse rounded-md', className)} />;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className="bg-line h-2 overflow-hidden rounded-full"
    >
      <div className="bg-brand h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%` }} />
    </div>
  );
}

const NOTICE = {
  info: { icon: Info, box: 'bg-brand-soft text-ink-2 ring-brand-line', iconClass: 'text-brand' },
  warn: { icon: AlertTriangle, box: 'bg-warn-soft text-warn ring-warn/20', iconClass: 'text-warn' },
  bad: { icon: XCircle, box: 'bg-bad-soft text-bad ring-bad/20', iconClass: 'text-bad' },
  ok: { icon: CheckCircle2, box: 'bg-ok-soft text-ok ring-ok/20', iconClass: 'text-ok' },
} as const;

/** An inline message. Use role="alert" for problems the user must notice immediately. */
export function Notice({
  tone = 'info',
  children,
  className,
  alert,
}: {
  tone?: keyof typeof NOTICE;
  children: ReactNode;
  className?: string;
  alert?: boolean;
}) {
  const { icon: Icon, box, iconClass } = NOTICE[tone];
  return (
    <div
      role={alert ? 'alert' : 'status'}
      className={cx('flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm ring-1 ring-inset', box, className)}
    >
      <Icon className={cx('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
