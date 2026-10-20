'use client';
import { useRef } from 'react';
import { cx } from '@/lib/client/cx';
import { Icon } from './Icon.js';

/** Accessible tab list (arrow keys, Home/End). Pair with <TabPanel>. */
export function Tabs({ idBase, label, value, onChange, items, orientation = 'horizontal', className }) {
  const refs = useRef({});
  const go = (i) => { const it = items[(i + items.length) % items.length]; onChange(it.value); refs.current[it.value]?.focus(); };
  const onKey = (e, i) => {
    const step = orientation === 'vertical' ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
    if (step[e.key] !== undefined) { e.preventDefault(); go(i + step[e.key]); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(items.length - 1); }
  };
  return (
    <div role="tablist" aria-label={label} aria-orientation={orientation} className={cx('tabs', `tabs--${orientation}`, className)}>
      {items.map((it, i) => (
        <button
          key={it.value} ref={(el) => { refs.current[it.value] = el; }} role="tab" type="button"
          id={`${idBase}-tab-${it.value}`} aria-selected={value === it.value} aria-controls={`${idBase}-panel-${it.value}`}
          tabIndex={value === it.value ? 0 : -1} className={cx('tab', value === it.value && 'is-on')}
          onClick={() => onChange(it.value)} onKeyDown={(e) => onKey(e, i)}
        >
          {it.icon && <Icon name={it.icon} size={16} />}
          <span className="tab__label">{it.label}</span>
          {it.badge ? <span className={cx('tab__badge', it.tone && `tab__badge--${it.tone}`)}>{it.badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function TabPanel({ idBase, value, current, children, className }) {
  if (value !== current) return null;
  return <div role="tabpanel" id={`${idBase}-panel-${value}`} aria-labelledby={`${idBase}-tab-${value}`} className={className}>{children}</div>;
}
