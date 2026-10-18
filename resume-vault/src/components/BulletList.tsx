'use client';

import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, cx } from './ui';

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
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {bullets.length === 0 ? <p className="mb-2 text-sm text-muted">No bullet points yet.</p> : null}
      <ul className="space-y-2">
        {bullets.map((b, i) => {
          const error = errors[`${errorPrefix}.${i}.text`];
          const hidden = mode === 'resume' && b.included === false;
          return (
            <li key={b.id ?? `new-${i}`} className="rounded-md border border-rule bg-surface p-2">
              <div className="flex items-start gap-2">
                {mode === 'resume' ? (
                  <input
                    type="checkbox"
                    aria-label={`Show bullet ${i + 1} on this resume`}
                    checked={b.included !== false}
                    onChange={(e) => update(i, { included: e.target.checked })}
                    className="mt-2 h-4 w-4 accent-navy"
                  />
                ) : null}
                <textarea
                  aria-label={`Bullet ${i + 1}`}
                  value={b.text}
                  rows={2}
                  onChange={(e) => update(i, { text: e.target.value })}
                  aria-invalid={!!error}
                  className={cx('min-h-[3.25rem] flex-1 resize-y rounded border border-rule px-2 py-1.5 text-sm leading-relaxed', hidden && 'text-muted line-through', error && 'border-bad')}
                />
                <div className="flex flex-col gap-0.5">
                  <button type="button" aria-label={`Move bullet ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)} className="rounded p-1 text-muted hover:bg-navy-soft disabled:opacity-30">
                    <ArrowUp className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" aria-label={`Move bullet ${i + 1} down`} disabled={i === bullets.length - 1} onClick={() => move(i, 1)} className="rounded p-1 text-muted hover:bg-navy-soft disabled:opacity-30">
                    <ArrowDown className="h-4 w-4" aria-hidden />
                  </button>
                  <button type="button" aria-label={`Remove bullet ${i + 1}`} onClick={() => onChange(bullets.filter((_, idx) => idx !== i))} className="rounded p-1 text-muted hover:bg-bad-bg hover:text-bad">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 pl-6 text-xs">
                {mode === 'library' ? (
                  <label className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={b.verified} onChange={(e) => update(i, { verified: e.target.checked })} className="h-3.5 w-3.5 accent-navy" />
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
                  <span role="alert" className="font-medium text-bad">
                    {error}
                  </span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Button size="sm" className="mt-2" onClick={() => onChange([...bullets, { text: '', verified: true, ...(mode === 'resume' ? { included: true } : {}) }])}>
        <Plus className="h-4 w-4" aria-hidden />
        Add bullet
      </Button>
    </fieldset>
  );
}
