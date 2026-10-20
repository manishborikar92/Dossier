'use client';
import { useId, useState } from 'react';
import { cx } from '@/lib/client/cx';
import { Badge, Button, Icon, StatusBadge } from '@/components/ui';

/** A checkbox row. The label is the clickable text; tools sit beside it. */
export function PickRow({ checked, onChange, label, sub, extra, tools, dim, children }) {
  const id = useId();
  return (
    <div className={cx('pick', dim && 'is-off')}>
      <input id={id} type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <div className="pick__main">
        <label htmlFor={id} className="pick__label">{label}{sub && <small>{sub}</small>}</label>
        {extra}
        {children}
      </div>
      {tools && <div className="tools">{tools}</div>}
    </div>
  );
}

/** Checklist of one entry's bullets: selected ones first (reorderable), then the rest. Unconfirmed text is highlighted. */
export default function BulletPicker({ bullets, selected, overrides, onToggle, onMove, onOverride }) {
  const [editing, setEditing] = useState(null);
  const ordered = [...selected.map((id) => bullets.find((b) => b.id === id)).filter(Boolean), ...bullets.filter((b) => !selected.includes(b.id))];
  return (
    <div className="bpick">
      {ordered.map((b) => {
        const on = selected.includes(b.id);
        const text = overrides[b.id] ?? b.text;
        const edited = overrides[b.id] !== undefined;
        return (
          <PickRow
            key={b.id} checked={on} dim={!on} onChange={() => onToggle(b.id)}
            label={b.status === 'prep' ? <mark className="proof">{text}</mark> : <span className={b.status === 'exclude' ? 'struck' : undefined}>{text}</span>}
            extra={(b.status !== 'confident' || edited) ? (
              <div className="pick__badges">
                {b.status !== 'confident' && <StatusBadge status={b.status} />}
                {edited && <Badge tone="info" icon="pencil">Edited for this resume</Badge>}
                {edited && <button type="button" className="linkbtn" onClick={() => onOverride(b.id, undefined, b.text)}>Reset</button>}
              </div>
            ) : null}
            tools={(
              <>
                {on && <Button variant="ghost" size="sm" icon="arrow-up" aria-label="Move bullet up" onClick={() => onMove(b.id, -1)} />}
                {on && <Button variant="ghost" size="sm" icon="arrow-down" aria-label="Move bullet down" onClick={() => onMove(b.id, 1)} />}
                <Button variant="ghost" size="sm" icon="pencil" aria-label="Edit wording for this resume only" aria-expanded={editing === b.id} onClick={() => setEditing(editing === b.id ? null : b.id)} />
              </>
            )}
          >
            {editing === b.id && (
              <div className="pick__edit">
                <textarea className="textarea" rows={3} autoFocus aria-label="Bullet wording for this resume only" value={text} onChange={(e) => onOverride(b.id, e.target.value, b.text)} />
                <small className="muted">Changes only this resume. The library keeps the original.</small>
              </div>
            )}
          </PickRow>
        );
      })}
    </div>
  );
}
