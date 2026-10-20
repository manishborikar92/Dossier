'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/lib/client/cx';
import { Button } from './Button.js';
import { Icon } from './Icon.js';

/** Dropdown menu. items: [{ label, icon, onSelect | href, download, tone, disabled, separator }] */
export function Menu({ label, icon, iconRight, variant = 'secondary', size = 'md', items, align = 'end', iconOnly, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);
  const id = useId();

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!wrap.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') { setOpen(false); wrap.current?.querySelector('button[aria-haspopup]')?.focus(); } };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    wrap.current?.querySelector('[role="menuitem"]:not([disabled])')?.focus();
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  const onKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const els = [...wrap.current.querySelectorAll('[role="menuitem"]:not([disabled])')];
    const i = els.indexOf(document.activeElement);
    els[(i + (e.key === 'ArrowDown' ? 1 : -1) + els.length) % els.length]?.focus();
  };

  return (
    <div className="menu-wrap" ref={wrap}>
      <Button
        variant={variant} size={size} icon={icon} iconRight={iconRight ?? (iconOnly ? undefined : 'chevron-down')}
        aria-haspopup="menu" aria-expanded={open} aria-controls={open ? id : undefined} aria-label={ariaLabel}
        onClick={() => setOpen(!open)}
      >
        {iconOnly ? null : label}
      </Button>
      {open && (
        <div id={id} role="menu" className={cx('menu', `menu--${align}`)} onKeyDown={onKey}>
          {items.map((it, i) => it.separator ? <hr key={i} className="menu__sep" /> : (
            it.href ? (
              <a key={it.label} role="menuitem" className={cx('menu__item', it.tone && `menu__item--${it.tone}`)} href={it.href} target={it.external ? '_blank' : undefined} rel={it.external ? 'noreferrer' : undefined} onClick={() => setOpen(false)}>
                {it.icon && <Icon name={it.icon} size={16} />}{it.label}
              </a>
            ) : (
              <button key={it.label} role="menuitem" type="button" disabled={it.disabled} className={cx('menu__item', it.tone && `menu__item--${it.tone}`)} onClick={() => { setOpen(false); it.onSelect?.(); }}>
                {it.icon && <Icon name={it.icon} size={16} />}{it.label}
              </button>
            )
          ))}
        </div>
      )}
    </div>
  );
}
