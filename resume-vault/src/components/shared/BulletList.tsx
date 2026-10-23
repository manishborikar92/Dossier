'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, IconButton } from '../ui';
import { cx } from '@/lib/classes';

export interface EditableBullet {
  id?: number;
  text: string;
  verified: boolean;
  /** Only used on resumes: whether this bullet is printed. */
  included?: boolean;
}

interface Props {
  bullets: EditableBullet[];
  onChange: (bullets: EditableBullet[]) => void;
  /** 'library' lets you mark bullets verified; 'resume' lets you hide bullets for this resume only. */
  mode: 'library' | 'resume';
  errors?: Record<string, string>;
  errorPrefix?: string;
  label?: string;
}

export function BulletList({ bullets, onChange, mode, errors = {}, errorPrefix = 'bullets', label = 'Bullet points' }: Props) {
  const update = (i: number, patch: Partial<EditableBullet>) => onChange(bullets.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= bullets.length) return;
    const next = [...bullets];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <fieldset>
      <legend className="text-ink-2 mb-2 text-[13px] font-medium">{label}</legend>
      {bullets.length === 0 ? <p className="text-muted mb-2 text-sm">No bullet points yet.</p> : null}
      <ul className="space-y-2">
        {bullets.map((b, i) => {
          const error = errors[`${errorPrefix}.${i}.text`];
          const hidden = mode === 'resume' && b.included === false;
          return (
            <li key={b.id ?? `new-${i}`} className="border-line bg-sunken rounded-lg border p-2.5">
              <div className="flex items-start gap-2">
                {mode === 'resume' ? (
                  <input
                    type="checkbox"
                    aria-label={`Show bullet ${i + 1} on this resume`}
                    checked={b.included !== false}
                    onChange={(e) => update(i, { included: e.target.checked })}
                    className="accent-brand mt-2.5 size-4"
                  />
                ) : null}
                <textarea
                  aria-label={`Bullet ${i + 1}`}
                  value={b.text}
                  rows={2}
                  onChange={(e) => update(i, { text: e.target.value })}
                  aria-invalid={!!error}
                  className={cx(
                    'border-line-strong bg-surface focus:border-brand focus:ring-brand/15 min-h-14 flex-1 resize-y rounded-lg border px-2.5 py-2 text-sm leading-relaxed focus:ring-[3px] focus:outline-none',
                    hidden && 'text-muted line-through',
                    error && 'border-bad',
                  )}
                />
                <div className="flex flex-col">
                  <IconButton
                    label={`Move bullet ${i + 1} up`}
                    icon={ArrowUp}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    className="size-7"
                  />
                  <IconButton
                    label={`Move bullet ${i + 1} down`}
                    icon={ArrowDown}
                    disabled={i === bullets.length - 1}
                    onClick={() => move(i, 1)}
                    className="size-7"
                  />
                  <IconButton
                    label={`Remove bullet ${i + 1}`}
                    icon={Trash2}
                    tone="danger"
                    onClick={() => onChange(bullets.filter((_, idx) => idx !== i))}
                    className="size-7"
                  />
                </div>
              </div>
              <div className={cx('mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs', mode === 'resume' && 'pl-6')}>
                {mode === 'library' ? (
                  <label className="text-ink-2 inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={b.verified}
                      onChange={(e) => update(i, { verified: e.target.checked })}
                      className="accent-brand size-3.5"
                    />
                    I have checked that this is accurate
                  </label>
                ) : b.verified ? (
                  <Badge tone="ok">Verified</Badge>
                ) : (
                  <Badge tone="warn" title="Mark it verified in your library once you have checked it">
                    Not verified yet
                  </Badge>
                )}
                {mode === 'library' && !b.verified ? <Badge tone="warn">Unverified</Badge> : null}
                {error ? (
                  <span role="alert" className="text-bad font-medium">
                    {error}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Button
        size="sm"
        className="mt-2.5"
        onClick={() => onChange([...bullets, { text: '', verified: true, ...(mode === 'resume' ? { included: true } : {}) }])}
      >
        <Plus className="size-4" aria-hidden />
        Add bullet
      </Button>
    </fieldset>
  );
}
