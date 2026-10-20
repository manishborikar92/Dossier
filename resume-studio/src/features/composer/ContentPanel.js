'use client';
import { useState } from 'react';
import { Button, Check, Disclosure } from '@/components/ui';
import { DEFAULT_ORDER, SECTION_TITLES } from '@/lib/domain/templates';
import { isOk } from '@/lib/domain/tailor';
import { StatusBadge } from '@/components/ui';
import BulletPicker, { PickRow } from './BulletPicker.js';

const move = (onUp, onDown, up = true, down = true) => (
  <>
    <Button variant="ghost" size="sm" icon="arrow-up" aria-label="Move up" disabled={!up} onClick={onUp} />
    <Button variant="ghost" size="sm" icon="arrow-down" aria-label="Move down" disabled={!down} onClick={onDown} />
  </>
);

export default function ContentPanel({ ed }) {
  const { data, resume } = ed;
  const sel = resume.selection;
  const order = resume.sectionOrder?.length ? resume.sectionOrder : DEFAULT_ORDER;
  const [showArchived, setShowArchived] = useState(false);

  const archivedOk = (p) => p.visible !== false || showArchived || sel.projects.some((x) => x.id === p.id);
  const projectsOrdered = [
    ...sel.projects.map((s) => data.projects.find((p) => p.id === s.id)).filter(Boolean),
    ...data.projects.filter((p) => archivedOk(p) && !sel.projects.some((s) => s.id === p.id)),
  ];
  const summary = data.summaries.find((s) => s.id === sel.summaryId);
  const summaryKey = summary ? `summary:${summary.id}` : null;

  return (
    <div className="panel">
      <header className="panel__head"><h2>Content</h2><p>Tick what belongs on this resume, then reorder it.</p></header>

      <Disclosure title="Section order" defaultOpen>
        {order.map((key, i) => (
          <PickRow
            key={key} checked={resume.sections?.[key] !== false} onChange={() => ed.toggleSection(key)} label={SECTION_TITLES[key]}
            tools={move(() => ed.moveSection(key, -1), () => ed.moveSection(key, 1), i > 0, i < order.length - 1)}
          />
        ))}
      </Disclosure>

      <Disclosure title="Summary">
        <select className="select" aria-label="Summary to use" value={sel.summaryId || ''} onChange={(e) => ed.patchSel({ summaryId: e.target.value || null })}>
          <option value="">None</option>
          {data.summaries.map((s) => <option key={s.id} value={s.id}>{s.label}{s.status !== 'confident' ? ' (needs review)' : ''}</option>)}
        </select>
        {summary && (
          <div className="stack">
            <textarea className="textarea" rows={6} aria-label="Summary text for this resume" value={resume.overrides[summaryKey] ?? summary.text} onChange={(e) => ed.setOverride(summaryKey, e.target.value, summary.text)} />
            {resume.overrides[summaryKey] !== undefined && <button type="button" className="linkbtn" onClick={() => ed.setOverride(summaryKey, undefined, summary.text)}>Reset to the library text</button>}
          </div>
        )}
      </Disclosure>

      <Disclosure title="Contact line" count={`${sel.contactIds.length} of ${data.profile.contact.length}`}>
        {data.profile.contact.map((c) => <PickRow key={c.id} checked={sel.contactIds.includes(c.id)} onChange={() => ed.toggleList('contactIds', c.id)} label={c.value} sub={c.type} />)}
      </Disclosure>

      <Disclosure title="Skills" count={sel.skills.reduce((n, g) => n + g.items.length, 0)}>
        {data.skills.map((g) => {
          const usable = g.items.filter((i) => i.status !== 'exclude');
          if (!usable.length) return null;
          const chosen = sel.skills.find((x) => x.groupId === g.id)?.items || [];
          return (
            <div key={g.id} className="group">
              <h4>{g.label}</h4>
              {usable.map((it) => <PickRow key={it.id} checked={chosen.includes(it.id)} onChange={() => ed.toggleSkill(g.id, it.id)} label={it.name} extra={it.status !== 'confident' ? <div className="pick__badges"><StatusBadge status={it.status} /></div> : null} />)}
            </div>
          );
        })}
        <p className="muted small">Skills you excluded in the library are hidden here on purpose.</p>
      </Disclosure>

      <Disclosure title="Experience" count={sel.experience.length} defaultOpen>
        {data.experience.filter((e) => e.visible !== false).map((e) => {
          const entry = sel.experience.find((x) => x.id === e.id);
          return (
            <div key={e.id} className="entry">
              <PickRow
                checked={!!entry} onChange={() => ed.toggleEntry('experience', e.id, e.bullets.filter(isOk).slice(0, 5).map((b) => b.id))}
                label={<b>{e.title}</b>} sub={`${e.company}, ${e.dates}`}
                tools={entry ? move(() => ed.moveEntry('experience', e.id, -1), () => ed.moveEntry('experience', e.id, 1)) : null}
              />
              {entry && <BulletPicker bullets={e.bullets} selected={entry.bullets} overrides={resume.overrides} onToggle={(b) => ed.toggleBullet('experience', e.id, b)} onMove={(b, d) => ed.moveBullet('experience', e.id, b, d)} onOverride={ed.setOverride} />}
            </div>
          );
        })}
      </Disclosure>

      <Disclosure title="Projects" count={sel.projects.length} defaultOpen>
        {projectsOrdered.map((p) => {
          const entry = sel.projects.find((x) => x.id === p.id);
          const none = !p.bullets.some(isOk);
          return (
            <div key={p.id} className="entry">
              <PickRow
                checked={!!entry} onChange={() => ed.toggleEntry('projects', p.id, p.bullets.filter(isOk).slice(0, 4).map((b) => b.id))}
                label={<b>{p.title}</b>}
                sub={[p.ownership, p.year, p.visible === false ? 'archived' : null].filter(Boolean).join(', ')}
                extra={none ? <div className="pick__badges"><StatusBadge status="prep" /><span className="muted small">No confident bullets yet</span></div> : null}
                tools={entry ? move(() => ed.moveEntry('projects', p.id, -1), () => ed.moveEntry('projects', p.id, 1)) : null}
              />
              {entry && <BulletPicker bullets={p.bullets} selected={entry.bullets} overrides={resume.overrides} onToggle={(b) => ed.toggleBullet('projects', p.id, b)} onMove={(b, d) => ed.moveBullet('projects', p.id, b, d)} onOverride={ed.setOverride} />}
            </div>
          );
        })}
        <Check label="Show archived projects" checked={showArchived} onChange={setShowArchived} />
      </Disclosure>

      <Disclosure title="Education" count={sel.education.length}>
        {data.education.map((e) => <PickRow key={e.id} checked={sel.education.includes(e.id)} onChange={() => ed.toggleList('education', e.id)} label={e.degree} sub={e.institution} />)}
      </Disclosure>
      <Disclosure title="Certifications" count={sel.certifications.length}>
        {data.certifications.map((c) => <PickRow key={c.id} checked={sel.certifications.includes(c.id)} onChange={() => ed.toggleList('certifications', c.id)} label={c.text} extra={c.status !== 'confident' ? <div className="pick__badges"><StatusBadge status={c.status} /></div> : null} />)}
      </Disclosure>
      <Disclosure title="Leadership and involvement" count={sel.involvement.length}>
        {data.involvement.map((c) => <PickRow key={c.id} checked={sel.involvement.includes(c.id)} onChange={() => ed.toggleList('involvement', c.id)} label={c.role} />)}
      </Disclosure>
    </div>
  );
}
