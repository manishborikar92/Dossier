'use client';
import { useState } from 'react';
import { uid } from '../lib/ids.js';
import { Field, StatusPicker, move, csv, parseCsv } from './ui.js';

/** Comma-separated list input. Commits on blur so typing commas feels natural. */
export function TagsInput({ value = [], onChange, placeholder }) {
  const [text, setText] = useState(csv(value));
  const commit = () => onChange(parseCsv(text));
  return (
    <input
      value={text} placeholder={placeholder}
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
    />
  );
}

const Mini = ({ onUp, onDown, onDel, vertical }) => (
  <span className="mini" style={vertical ? { flexDirection: 'column' } : undefined}>
    {onUp && <button type="button" title="Move up" onClick={onUp}>▲</button>}
    {onDown && <button type="button" title="Move down" onClick={onDown}>▼</button>}
    {onDel && <button type="button" title="Delete" onClick={onDel}>✕</button>}
  </span>
);

export function BulletsEditor({ bullets = [], onChange }) {
  const patch = (i, p) => onChange(bullets.map((b, k) => (k === i ? { ...b, ...p } : b)));
  return (
    <div>
      {bullets.map((b, i) => (
        <div className="bullet-row" key={b.id}>
          <div>
            <textarea rows={2} value={b.text} onChange={(e) => patch(i, { text: e.target.value })} />
            <div className="row wrap gap-s" style={{ marginTop: 6 }}>
              <StatusPicker value={b.status} onChange={(s) => patch(i, { status: s })} />
              {b.source && b.source !== 'manual' && <span className="badge info">{b.source}</span>}
            </div>
          </div>
          <Mini vertical onUp={() => onChange(move(bullets, i, -1))} onDown={() => onChange(move(bullets, i, 1))}
            onDel={() => confirm('Delete this bullet?') && onChange(bullets.filter((_, k) => k !== i))} />
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onChange([...bullets, { id: uid('b'), text: '', tags: [], status: 'confident', source: 'manual' }])}>+ Add bullet</button>
    </div>
  );
}

export function SkillItemsEditor({ items = [], onChange }) {
  const patch = (i, p) => onChange(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div>
      {items.map((it, i) => (
        <div className="row" key={it.id} style={{ marginBottom: 6 }}>
          <input value={it.name} onChange={(e) => patch(i, { name: e.target.value })} />
          <StatusPicker value={it.status} onChange={(s) => patch(i, { status: s })} />
          <Mini onUp={() => onChange(move(items, i, -1))} onDown={() => onChange(move(items, i, 1))} onDel={() => onChange(items.filter((_, k) => k !== i))} />
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onChange([...items, { id: uid('sk'), name: '', status: 'confident', tags: [] }])}>+ Add skill</button>
    </div>
  );
}

function FieldInput({ f, item, set }) {
  const v = item[f.key];
  switch (f.type) {
    case 'text': return <Field label={f.label} hint={f.hint}><input value={v ?? ''} onChange={(e) => set({ [f.key]: e.target.value })} /></Field>;
    case 'textarea': return <Field label={f.label} hint={f.hint}><textarea rows={f.rows || 4} value={v ?? ''} onChange={(e) => set({ [f.key]: e.target.value })} /></Field>;
    case 'select': return (
      <Field label={f.label} hint={f.hint}>
        <select value={v} onChange={(e) => set({ [f.key]: e.target.value })}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      </Field>
    );
    case 'bool': return <label className="row" style={{ marginBottom: 10 }}><input type="checkbox" checked={!!v} onChange={(e) => set({ [f.key]: e.target.checked })} /><span>{f.label}</span></label>;
    case 'tags': return <Field label={f.label} hint={f.hint}><TagsInput key={item.id + f.key} value={v} onChange={(x) => set({ [f.key]: x })} /></Field>;
    case 'status': return <div style={{ marginBottom: 10 }}><div className="small muted" style={{ marginBottom: 3 }}>{f.label}</div><StatusPicker value={v} onChange={(s) => set({ [f.key]: s })} /></div>;
    case 'bullets': return <div style={{ marginBottom: 10 }}><div className="small muted" style={{ marginBottom: 6 }}>{f.label}</div><BulletsEditor bullets={v} onChange={(b) => set({ [f.key]: b })} /></div>;
    case 'skillitems': return <div style={{ marginBottom: 10 }}><div className="small muted" style={{ marginBottom: 6 }}>{f.label}</div><SkillItemsEditor items={v} onChange={(b) => set({ [f.key]: b })} /></div>;
    case 'info': return f.render(item);
    default: return null;
  }
}

/** Generic list + form editor driven by a small spec (see app/library/page.js). */
export function CollectionEditor({ items, onChange, spec }) {
  const [sel, setSel] = useState(items[0]?.id ?? null);
  const [q, setQ] = useState('');
  const item = items.find((i) => i.id === sel) || null;
  const set = (patch) => onChange(items.map((i) => (i.id === sel ? { ...i, ...patch } : i)));
  const add = () => { const n = spec.newItem(); onChange([...items, n]); setSel(n.id); };
  const remove = () => {
    if (!confirm(`Delete "${spec.label(item) || 'this item'}"? This cannot be undone (a backup copy is kept in data/_backups).`)) return;
    const idx = items.findIndex((i) => i.id === sel);
    onChange(items.filter((i) => i.id !== sel));
    setSel(items[idx + 1]?.id ?? items[idx - 1]?.id ?? null);
  };
  const shift = (d) => onChange(move(items, items.findIndex((i) => i.id === sel), d));
  const shown = items.filter((i) => !q || spec.label(i).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="split">
      <div>
        {spec.searchable && <input type="search" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />}
        <div className="list">
          {shown.map((i) => (
            <button key={i.id} type="button" className={`${i.id === sel ? 'on' : ''} ${spec.dim?.(i) ? 'dim' : ''}`} onClick={() => setSel(i.id)}>
              <div>{spec.label(i) || <span className="muted">(untitled)</span>}</div>
              {spec.meta && <div className="small muted">{spec.meta(i)}</div>}
            </button>
          ))}
          {!shown.length && <div className="muted small" style={{ padding: 12 }}>Nothing here yet.</div>}
        </div>
        <div className="row" style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={add}>+ Add {spec.noun}</button></div>
      </div>
      <div className="card">
        {item ? (
          <>
            <div className="row spread" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{spec.label(item) || `New ${spec.noun}`}</h2>
              <span className="row gap-s"><Mini onUp={() => shift(-1)} onDown={() => shift(1)} /><button type="button" className="btn sm danger" onClick={remove}>Delete</button></span>
            </div>
            {spec.fields.map((f) => <FieldInput key={f.key} f={f} item={item} set={set} />)}
          </>
        ) : <div className="muted">Select an item on the left, or add a new one.</div>}
      </div>
    </div>
  );
}

const CONTACT_TYPES = ['location', 'email', 'phone', 'linkedin', 'github', 'website', 'other'];

export function ProfileEditor({ profile, onChange }) {
  const patchContact = (i, p) => onChange({ ...profile, contact: profile.contact.map((c, k) => (k === i ? { ...c, ...p } : c)) });
  return (
    <div className="card" style={{ maxWidth: 820 }}>
      <Field label="Full name"><input value={profile.name} onChange={(e) => onChange({ ...profile, name: e.target.value })} /></Field>
      <h3 style={{ marginTop: 16 }}>Contact details</h3>
      <p className="small muted" style={{ marginTop: 0 }}>“Short form” is used when a resume has <i>Short links</i> turned on (e.g. in/yourname instead of linkedin.com/in/yourname). Untick “Default” to leave an item off new resumes.</p>
      {profile.contact.map((c, i) => (
        <div key={c.id} className="row wrap" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
          <div style={{ width: 120 }}><select value={c.type} onChange={(e) => patchContact(i, { type: e.target.value })}>{CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}</select></div>
          <div style={{ flex: 2, minWidth: 180 }}><input placeholder="Value" value={c.value} onChange={(e) => patchContact(i, { value: e.target.value })} /></div>
          <div style={{ flex: 1, minWidth: 130 }}><input placeholder="Short form (optional)" value={c.short} onChange={(e) => patchContact(i, { short: e.target.value })} /></div>
          <label className="row gap-s"><input type="checkbox" checked={c.on !== false} onChange={(e) => patchContact(i, { on: e.target.checked })} />Default</label>
          <Mini onUp={() => onChange({ ...profile, contact: move(profile.contact, i, -1) })} onDown={() => onChange({ ...profile, contact: move(profile.contact, i, 1) })}
            onDel={() => onChange({ ...profile, contact: profile.contact.filter((_, k) => k !== i) })} />
        </div>
      ))}
      <button type="button" className="btn sm" onClick={() => onChange({ ...profile, contact: [...profile.contact, { id: uid('c'), type: 'website', label: '', value: '', short: '', on: true }] })}>+ Add contact item</button>
    </div>
  );
}
