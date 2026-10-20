'use client';
import { Badge, Button, Field, StatusPicker } from '@/components/ui';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { uid } from '@/lib/domain/ids';
import { move } from '@/lib/client/format';

const SOURCE = { kb: 'Knowledge base', resume: 'Your resume', 'original-resume': 'Older resume' };

function Tools({ index, count, onMove, onDelete, noun }) {
  return (
    <div className="tools">
      <Button variant="ghost" size="sm" icon="arrow-up" aria-label={`Move ${noun} up`} disabled={index === 0} onClick={() => onMove(-1)} />
      <Button variant="ghost" size="sm" icon="arrow-down" aria-label={`Move ${noun} down`} disabled={index === count - 1} onClick={() => onMove(1)} />
      <Button variant="ghost" size="sm" icon="trash" aria-label={`Delete ${noun}`} onClick={onDelete} />
    </div>
  );
}

export function BulletsEditor({ bullets = [], onChange }) {
  const confirm = useConfirm();
  const patch = (i, p) => onChange(bullets.map((b, k) => (k === i ? { ...b, ...p } : b)));
  const remove = async (i) => {
    if (await confirm({ title: 'Delete this bullet?', body: bullets[i].text.slice(0, 140), confirmLabel: 'Delete bullet', danger: true })) onChange(bullets.filter((_, k) => k !== i));
  };
  return (
    <div className="bullets">
      {bullets.length === 0 && <p className="muted">No bullets yet.</p>}
      {bullets.map((b, i) => (
        <div key={b.id} className={`bullet bullet--${b.status}`}>
          <div className="bullet__main">
            <textarea className="textarea" rows={2} value={b.text} aria-label={`Bullet ${i + 1} text`} onChange={(e) => patch(i, { text: e.target.value })} />
            <div className="bullet__meta">
              <StatusPicker value={b.status} label={`Status of bullet ${i + 1}`} onChange={(s) => patch(i, { status: s })} />
              {b.source && b.source !== 'manual' && <Badge tone="info">{SOURCE[b.source] || b.source}</Badge>}
            </div>
          </div>
          <Tools index={i} count={bullets.length} noun="bullet" onMove={(d) => onChange(move(bullets, i, d))} onDelete={() => remove(i)} />
        </div>
      ))}
      <Button size="sm" icon="plus" onClick={() => onChange([...bullets, { id: uid('b'), text: '', tags: [], status: 'confident', source: 'manual' }])}>Add bullet</Button>
    </div>
  );
}

export function SkillItemsEditor({ items = [], onChange }) {
  const patch = (i, p) => onChange(items.map((x, k) => (k === i ? { ...x, ...p } : x)));
  return (
    <div className="bullets">
      {items.map((it, i) => (
        <div key={it.id} className={`skillrow bullet--${it.status}`}>
          <input className="input" value={it.name} aria-label={`Skill ${i + 1} name`} onChange={(e) => patch(i, { name: e.target.value })} />
          <StatusPicker value={it.status} label={`Status of ${it.name || 'skill'}`} onChange={(s) => patch(i, { status: s })} />
          <Tools index={i} count={items.length} noun="skill" onMove={(d) => onChange(move(items, i, d))} onDelete={() => onChange(items.filter((_, k) => k !== i))} />
        </div>
      ))}
      <Button size="sm" icon="plus" onClick={() => onChange([...items, { id: uid('sk'), name: '', status: 'confident', tags: [] }])}>Add skill</Button>
    </div>
  );
}

const CONTACT_TYPES = ['location', 'email', 'phone', 'linkedin', 'github', 'website', 'other'];

export function ProfileEditor({ profile, onChange }) {
  const patchContact = (i, p) => onChange({ ...profile, contact: profile.contact.map((c, k) => (k === i ? { ...c, ...p } : c)) });
  return (
    <div className="form form--narrow">
      <Field label="Full name"><input className="input" value={profile.name} onChange={(e) => onChange({ ...profile, name: e.target.value })} /></Field>
      <h3 className="form__h">Contact details</h3>
      <p className="muted">A short form (for example <code>in/yourname</code>) is used when a resume has short links turned on. Untick &ldquo;On new resumes&rdquo; to leave an item off by default.</p>
      <div className="contacts">
        {profile.contact.map((c, i) => (
          <div key={c.id} className="contactrow">
            <select className="select" aria-label={`Type of contact ${i + 1}`} value={c.type} onChange={(e) => patchContact(i, { type: e.target.value })}>{CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <input className="input" aria-label={`Value of contact ${i + 1}`} placeholder="Value" value={c.value} onChange={(e) => patchContact(i, { value: e.target.value })} />
            <input className="input" aria-label={`Short form of contact ${i + 1}`} placeholder="Short form (optional)" value={c.short} onChange={(e) => patchContact(i, { short: e.target.value })} />
            <label className="check check--inline"><input type="checkbox" checked={c.on !== false} onChange={(e) => patchContact(i, { on: e.target.checked })} /><span>On new resumes</span></label>
            <Tools index={i} count={profile.contact.length} noun="contact item" onMove={(d) => onChange({ ...profile, contact: move(profile.contact, i, d) })} onDelete={() => onChange({ ...profile, contact: profile.contact.filter((_, k) => k !== i) })} />
          </div>
        ))}
      </div>
      <Button size="sm" icon="plus" onClick={() => onChange({ ...profile, contact: [...profile.contact, { id: uid('c'), type: 'website', label: '', value: '', short: '', on: true }] })}>Add contact item</Button>
    </div>
  );
}
