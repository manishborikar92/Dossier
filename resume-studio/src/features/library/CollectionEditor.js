'use client';
import { useId, useState } from 'react';
import { cx } from '@/lib/client/cx';
import { Button, Check, EmptyState, Field, StatusPicker, TagsInput } from '@/components/ui';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { move } from '@/lib/client/format';
import { BulletsEditor, SkillItemsEditor } from './editors.js';

function FieldInput({ f, item, set }) {
  const v = item[f.key];
  switch (f.type) {
    case 'text': return <Field label={f.label} hint={f.hint}><input className="input" value={v ?? ''} onChange={(e) => set({ [f.key]: e.target.value })} /></Field>;
    case 'textarea': return <Field label={f.label} hint={f.hint}><textarea className="textarea" rows={f.rows || 4} value={v ?? ''} onChange={(e) => set({ [f.key]: e.target.value })} /></Field>;
    case 'select': return (
      <Field label={f.label} hint={f.hint}>
        <select className="select" value={v} onChange={(e) => set({ [f.key]: e.target.value })}>{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
      </Field>
    );
    case 'bool': return <Check label={f.label} hint={f.hint} checked={!!v} onChange={(c) => set({ [f.key]: c })} />;
    case 'tags': return <Field label={f.label} hint={f.hint}><TagsInput key={item.id + f.key} value={v} onChange={(x) => set({ [f.key]: x })} /></Field>;
    case 'status': return <div className="field"><span className="field__label">{f.label}</span><StatusPicker value={v} onChange={(s) => set({ [f.key]: s })} label={f.label} /></div>;
    case 'bullets': return <div className="field"><span className="field__label">{f.label}</span><BulletsEditor key={item.id} bullets={v} onChange={(b) => set({ [f.key]: b })} /></div>;
    case 'skillitems': return <div className="field"><span className="field__label">{f.label}</span><SkillItemsEditor key={item.id} items={v} onChange={(b) => set({ [f.key]: b })} /></div>;
    case 'info': return f.render(item);
    default: return null;
  }
}

/** Master-detail editor driven by a small spec (see specs.js): a list on the left, the selected item's form on the right. */
export default function CollectionEditor({ items, onChange, spec }) {
  const confirm = useConfirm();
  const searchId = useId();
  const [sel, setSel] = useState(items[0]?.id ?? null);
  const [q, setQ] = useState('');
  const item = items.find((i) => i.id === sel) || null;
  const set = (patch) => onChange(items.map((i) => (i.id === sel ? { ...i, ...patch } : i)));
  const add = () => { const n = spec.newItem(); onChange([...items, n]); setSel(n.id); setQ(''); };
  const remove = async () => {
    const ok = await confirm({ title: `Delete "${spec.label(item) || `this ${spec.noun}`}"?`, body: 'A backup copy of your data is kept in data/_backups, but this cannot be undone from the app.', confirmLabel: 'Delete', danger: true });
    if (!ok) return;
    const idx = items.findIndex((i) => i.id === sel);
    onChange(items.filter((i) => i.id !== sel));
    setSel(items[idx + 1]?.id ?? items[idx - 1]?.id ?? null);
  };
  const shift = (d) => onChange(move(items, items.findIndex((i) => i.id === sel), d));
  const shown = items.filter((i) => !q || spec.label(i).toLowerCase().includes(q.toLowerCase()));
  const idx = items.findIndex((i) => i.id === sel);

  return (
    <div className="master">
      <div className="master__list">
        {spec.searchable && (
          <div className="searchbox">
            <label htmlFor={searchId} className="sr-only">Filter {spec.noun}s</label>
            <input id={searchId} className="input" type="search" placeholder={`Filter ${spec.noun}s`} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        )}
        <ul className="itemlist" aria-label={`${spec.noun}s`}>
          {shown.map((i) => {
            const flag = spec.flag?.(i);
            return (
              <li key={i.id}>
                <button type="button" aria-current={i.id === sel ? 'true' : undefined} className={cx('itemlist__btn', i.id === sel && 'is-on', spec.dim?.(i) && 'is-dim')} onClick={() => setSel(i.id)}>
                  <span className="itemlist__title">{spec.label(i) || <em>Untitled</em>}</span>
                  <span className="itemlist__meta">{(spec.meta?.(i) || []).filter(Boolean).map((m) => <span key={m}>{m}</span>)}{flag ? <span className="flag">{flag}</span> : null}</span>
                </button>
              </li>
            );
          })}
          {!shown.length && <li className="itemlist__empty">{q ? 'No matches.' : 'Nothing here yet.'}</li>}
        </ul>
        <Button size="sm" icon="plus" onClick={add}>Add {spec.noun}</Button>
      </div>

      <div className="master__detail">
        {item ? (
          <div className="form">
            <div className="form__head">
              <h3>{spec.label(item) || `New ${spec.noun}`}</h3>
              <div className="tools">
                <Button variant="ghost" size="sm" icon="arrow-up" aria-label={`Move ${spec.noun} up in the list`} disabled={idx === 0} onClick={() => shift(-1)} />
                <Button variant="ghost" size="sm" icon="arrow-down" aria-label={`Move ${spec.noun} down in the list`} disabled={idx === items.length - 1} onClick={() => shift(1)} />
                <Button variant="danger" size="sm" icon="trash" onClick={remove}>Delete</Button>
              </div>
            </div>
            {spec.fields.map((f) => <FieldInput key={f.key} f={f} item={item} set={set} />)}
          </div>
        ) : (
          <EmptyState icon={spec.icon || 'file'} title={`No ${spec.noun} selected`} action={<Button variant="primary" icon="plus" onClick={add}>Add {spec.noun}</Button>}>
            Select one on the left, or add a new one.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
