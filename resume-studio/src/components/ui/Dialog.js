'use client';
import { useEffect, useId, useRef } from 'react';
import { cx } from '@/lib/client/cx';
import { Button } from './Button.js';

/** Modal built on the native <dialog>: focus trapping, Esc to close and inert background come from the browser. */
export function Dialog({ open, onClose, title, description, children, footer, size = 'md' }) {
  const ref = useRef(null);
  const id = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    if (!open && d.open) { if (d.close) d.close(); else d.removeAttribute('open'); }
  }, [open]);
  return (
    <dialog
      ref={ref} className={cx('dialog', `dialog--${size}`)} aria-labelledby={`${id}-t`} aria-describedby={description ? `${id}-d` : undefined}
      onCancel={(e) => { e.preventDefault(); onClose?.(); }} onClick={(e) => { if (e.target === ref.current) onClose?.(); }}
    >
      {open && (
        <div className="dialog__inner">
          <div className="dialog__head">
            <h2 id={`${id}-t`}>{title}</h2>
            <Button variant="ghost" size="sm" icon="x" aria-label="Close dialog" onClick={onClose} />
          </div>
          {description && <p id={`${id}-d`} className="dialog__desc">{description}</p>}
          <div className="dialog__body">{children}</div>
          {footer && <div className="dialog__foot">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
