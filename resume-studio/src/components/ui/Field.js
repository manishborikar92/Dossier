'use client';
import { cloneElement, isValidElement, useId, useState } from 'react';
import { cx } from '@/lib/client/cx';
import { parseCsvList, csvList } from './csv.js';

/** Label + control + hint + error, wired together for screen readers. Children: element or render-prop. */
export function Field({ label, hint, error, children, className }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const props = { id, 'aria-describedby': [hintId, errId].filter(Boolean).join(' ') || undefined, 'aria-invalid': error ? true : undefined };
  return (
    <div className={cx('field', className)}>
      <label htmlFor={id} className="field__label">{label}</label>
      {typeof children === 'function' ? children(props) : isValidElement(children) ? cloneElement(children, props) : children}
      {hint && <p id={hintId} className="field__hint">{hint}</p>}
      {error && <p id={errId} className="field__error">{error}</p>}
    </div>
  );
}

export function Check({ label, hint, checked, onChange, disabled, className }) {
  const id = useId();
  return (
    <div className={cx('check', className)}>
      <input id={id} type="checkbox" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <label htmlFor={id}>{label}{hint && <span className="check__hint">{hint}</span>}</label>
    </div>
  );
}

/** Comma-separated list input that commits on blur/Enter so typing commas feels natural. */
export function TagsInput({ value = [], onChange, placeholder, ...rest }) {
  const [text, setText] = useState(csvList(value));
  const commit = () => onChange(parseCsvList(text));
  return (
    <input
      className="input" value={text} placeholder={placeholder} {...rest}
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
    />
  );
}
