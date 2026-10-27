'use client';

import { AlertCircle, X } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';
import { CONTROL_CLASS, cx } from '@/lib/classes';

interface FieldShellProps {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldShell({ label, id, error, hint, required, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="text-ink-2 mb-1.5 block text-[13px] font-medium">
        {label}
        {required ? (
          <span className="text-bad" aria-hidden>
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-bad mt-1.5 flex items-start gap-1 text-xs font-medium">
          <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted mt-1.5 text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
}

export function TextField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  type = 'text',
  placeholder,
  maxLength,
  className,
  disabled,
  autoFocus,
  autoComplete,
}: TextFieldProps) {
  const id = useId();
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} required={required} className={className}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(e) => onChange(e.target.value)}
        className={cx(CONTROL_CLASS, error && 'border-bad')}
      />
    </FieldShell>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  placeholder,
  rows = 3,
  maxLength,
  className,
}: Omit<TextFieldProps, 'type' | 'autoComplete'> & { rows?: number }) {
  const id = useId();
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} required={required} className={className}>
      <textarea
        id={id}
        value={value}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-invalid={!!error}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(e) => onChange(e.target.value)}
        className={cx(CONTROL_CLASS, 'resize-y leading-relaxed', error && 'border-bad')}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  error,
  hint,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  error?: string;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <FieldShell label={label} id={id} error={error} hint={hint} className={className}>
      <select
        id={id}
        value={value}
        aria-describedby={describedBy(id, error, hint)}
        onChange={(e) => onChange(e.target.value)}
        className={cx(CONTROL_CLASS, 'pr-8', error && 'border-bad')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-brand mt-0.5 size-4 shrink-0"
      />
      <label htmlFor={id} className="text-ink-2 text-sm">
        {label}
        {hint ? <span className="text-muted block text-xs">{hint}</span> : null}
      </label>
    </div>
  );
}

/** Month input that stores 'YYYY-MM' (or '' for empty). Browsers without a month picker show a text box. */
export function MonthField({
  label,
  value,
  onChange,
  error,
  hint,
  required,
  className,
}: Pick<TextFieldProps, 'label' | 'value' | 'onChange' | 'error' | 'hint' | 'required' | 'className'>) {
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange}
      error={error}
      hint={hint ?? 'Format: 2025-06'}
      required={required}
      type="month"
      className={className}
    />
  );
}

/** Comma/Enter separated chips, used for technologies, tags and keywords. */
export function TagInput({
  label,
  value,
  onChange,
  hint,
  placeholder,
}: {
  label: string;
  value: string[];
  onChange: (v: string[]) => void;
  hint?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const parts = raw
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const p of parts) if (!next.some((n) => n.toLowerCase() === p.toLowerCase())) next.push(p);
    onChange(next);
    setDraft('');
  };
  return (
    <div>
      <label htmlFor={id} className="text-ink-2 mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <div className="border-line-strong bg-surface shadow-xs focus-within:border-brand focus-within:ring-brand/15 flex flex-wrap gap-1.5 rounded-lg border p-1.5 focus-within:ring-[3px]">
        {value.map((tag) => (
          <span
            key={tag}
            className="bg-brand-soft text-brand inline-flex items-center gap-1 rounded-md py-0.5 pr-1 pl-2 text-[13px] font-medium"
          >
            {tag}
            <button
              type="button"
              aria-label={`Remove ${tag}`}
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="hover:bg-brand/10 rounded p-0.5"
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          placeholder={value.length === 0 ? placeholder : 'Add another'}
          onChange={(e) => (e.target.value.includes(',') ? add(e.target.value) : setDraft(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
            } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          className="placeholder:text-muted/70 min-w-32 flex-1 bg-transparent px-1.5 py-1 text-sm outline-none"
        />
      </div>
      {hint ? <p className="text-muted mt-1.5 text-xs">{hint}</p> : null}
    </div>
  );
}
