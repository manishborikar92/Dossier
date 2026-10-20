import { cx } from '@/lib/client/cx';
import { Icon } from './Icon.js';

const TONE_ICON = { info: 'info', ok: 'check', warn: 'alert', error: 'alert' };

export function Notice({ tone = 'info', title, children, action, className }) {
  return (
    <div className={cx('notice', `notice--${tone}`, className)} role={tone === 'error' ? 'alert' : undefined}>
      <Icon name={TONE_ICON[tone]} size={18} className="notice__icon" />
      <div className="notice__body">{title && <strong>{title}</strong>}{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({ icon = 'file', title, children, action }) {
  return (
    <div className="empty">
      <Icon name={icon} size={28} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ w, h = 16, className }) {
  return <span className={cx('skeleton', className)} style={{ width: w, height: h }} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading">
      <Skeleton w="30%" h={34} />
      <div style={{ height: 12 }} />
      <Skeleton w="55%" h={16} />
      <div style={{ height: 28 }} />
      <div className="skeleton-row"><Skeleton w={220} h={285} /><Skeleton w={220} h={285} /><Skeleton w={220} h={285} /></div>
    </div>
  );
}

/** Stacked bar of proportions (e.g. confident / needs review / excluded). */
export function MeterBar({ segments, label }) {
  const total = segments.reduce((n, s) => n + s.value, 0);
  return (
    <div className="meter" role="img" aria-label={label}>
      {total === 0 ? <i className="meter__seg meter__seg--none" style={{ flexGrow: 1 }} /> : segments.filter((s) => s.value > 0).map((s) => <i key={s.tone} className={`meter__seg meter__seg--${s.tone}`} style={{ flexGrow: s.value }} />)}
    </div>
  );
}
