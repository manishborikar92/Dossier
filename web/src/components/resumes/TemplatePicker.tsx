'use client';

import { TEMPLATE_IDS } from '@/lib/schemas';
import { cx } from '@/lib/classes';
import { TEMPLATES } from '@/lib/templates';
import type { TemplateId } from '@/lib/types';

/** Radio cards for choosing a template. Shared by the new-resume dialog and the builder's Setup tab. */
export function TemplatePicker({
  value,
  onChange,
  name = 'template',
}: {
  value: TemplateId;
  onChange: (id: TemplateId) => void;
  name?: string;
}) {
  return (
    <fieldset>
      <legend className="text-ink-2 mb-1.5 text-[13px] font-medium">Template</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {TEMPLATE_IDS.map((id) => (
          <label
            key={id}
            className={cx(
              'flex cursor-pointer flex-col rounded-xl border p-3 text-sm transition-colors',
              value === id ? 'border-brand bg-brand-soft ring-brand/20 ring-2' : 'border-line-strong bg-surface hover:bg-sunken',
            )}
          >
            <span className="flex items-center gap-2">
              <input type="radio" name={name} value={id} checked={value === id} onChange={() => onChange(id)} className="accent-brand" />
              <span className="text-ink font-semibold">{TEMPLATES[id].label}</span>
            </span>
            <span className="text-muted mt-1 text-xs leading-relaxed">{TEMPLATES[id].description}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
