import { cx } from '@/lib/client/cx';
import { Icon } from './Icon.js';

export function Badge({ tone = 'muted', icon, children, className, ...rest }) {
  return <span className={cx('badge', `badge--${tone}`, className)} {...rest}>{icon && <Icon name={icon} size={12} />}{children}</span>;
}

export const STATUS = {
  confident: { tone: 'ok', icon: 'check', label: 'Confident', hint: 'You can explain this in an interview' },
  prep: { tone: 'hl', icon: 'pencil', label: 'Needs review', hint: 'Check the wording and your understanding first' },
  exclude: { tone: 'no', icon: 'ban', label: 'Excluded', hint: 'Never use this' },
};

/** Status is always shown as icon + text, never colour alone. */
export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.prep;
  return <Badge tone={s.tone} icon={s.icon} title={s.hint}>{s.label}</Badge>;
}
