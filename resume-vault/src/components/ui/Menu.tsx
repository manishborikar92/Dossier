'use client';

import type { LucideIcon } from 'lucide-react';
import { ChevronDown } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { buttonClass, cx, type ButtonVariant } from '@/lib/classes';

export interface MenuItem {
  label: string;
  description?: string;
  icon?: LucideIcon;
  /** Link (opens or downloads). Use onSelect for actions. */
  href?: string;
  download?: boolean;
  newTab?: boolean;
  onSelect?: () => void;
}

/** A dropdown menu button with keyboard support (arrow keys, Escape). */
export function Menu({
  label,
  icon: Icon,
  items,
  variant = 'secondary',
}: {
  label: ReactNode;
  icon?: LucideIcon;
  items: MenuItem[];
  variant?: ButtonVariant;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    panel.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return () => document.removeEventListener('pointerdown', onPointer);
  }, [open]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      root.current?.querySelector<HTMLElement>('button[aria-haspopup]')?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const entries = [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (entries.length === 0) return;
    e.preventDefault();
    const index = entries.indexOf(document.activeElement as HTMLElement);
    const next = e.key === 'ArrowDown' ? (index + 1) % entries.length : (index - 1 + entries.length) % entries.length;
    entries[next].focus();
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={buttonClass(variant)}
      >
        {Icon ? <Icon className="size-4" aria-hidden /> : null}
        {label}
        <ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open ? (
        <div
          ref={panel}
          id={menuId}
          role="menu"
          className="border-line bg-surface shadow-pop absolute right-0 z-40 mt-1.5 w-64 rounded-xl border p-1.5"
        >
          {items.map((item) => {
            const content = (
              <>
                {item.icon ? <item.icon className="text-muted mt-0.5 size-4 shrink-0" aria-hidden /> : null}
                <span className="min-w-0">
                  <span className="text-ink block text-sm font-medium">{item.label}</span>
                  {item.description ? <span className="text-muted block text-xs">{item.description}</span> : null}
                </span>
              </>
            );
            const cls = 'hover:bg-sunken flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left outline-none';
            return item.href ? (
              <a
                key={item.label}
                role="menuitem"
                href={item.href}
                download={item.download || undefined}
                target={item.newTab ? '_blank' : undefined}
                rel={item.newTab ? 'noreferrer' : undefined}
                onClick={() => setOpen(false)}
                className={cls}
              >
                {content}
              </a>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  item.onSelect?.();
                }}
                className={cls}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
