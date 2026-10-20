import { cx } from '@/lib/client/cx';
import { Icon } from './Icon.js';
import { STATUS } from './Badge.js';

export function Segmented({ label, value, onChange, options, size = 'md', className }) {
  return (
    <div role="group" aria-label={label} className={cx('seg', size === 'sm' && 'seg--sm', className)}>
      {options.map((o) => (
        <button
          key={o.value} type="button" title={o.title} aria-pressed={value === o.value}
          className={cx('seg__btn', o.tone && `seg__btn--${o.tone}`, value === o.value && 'is-on')}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={13} />}{o.label}
        </button>
      ))}
    </div>
  );
}

export function StatusPicker({ value, onChange, label = 'Status' }) {
  return (
    <Segmented
      label={label} size="sm" value={value} onChange={onChange}
      options={Object.entries(STATUS).map(([k, s]) => ({ value: k, label: s.label, tone: s.tone, icon: s.icon, title: s.hint }))}
    />
  );
}
