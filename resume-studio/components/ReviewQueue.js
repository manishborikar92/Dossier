'use client';
// One place to review every bullet you have not yet marked "Confident" - the heart of the honesty check.
import { useState } from 'react';
import { StatusPicker } from './ui.js';

export default function ReviewQueue({ data, update }) {
  const [filter, setFilter] = useState('prep');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(30);
  const [showArchived, setShowArchived] = useState(false);

  const rows = [];
  for (const e of data.experience) for (const b of e.bullets) rows.push({ col: 'experience', owner: e.id, label: `${e.title} — ${e.company}`, b });
  for (const p of data.projects) {
    if (p.visible === false && !showArchived) continue;
    for (const b of p.bullets) rows.push({ col: 'projects', owner: p.id, label: p.title, b, archived: p.visible === false });
  }
  const count = (s) => rows.filter((r) => r.b.status === s).length;
  const shown = rows.filter((r) => (filter === 'all' || r.b.status === filter) && (!q || `${r.label} ${r.b.text}`.toLowerCase().includes(q.toLowerCase())));

  const patch = (r, p) => update(r.col, (arr) => arr.map((o) => (o.id !== r.owner ? o : { ...o, bullets: o.bullets.map((x) => (x.id === r.b.id ? { ...x, ...p } : x)) })));

  return (
    <div>
      <div className="notice info">
        <b>How this works:</b> imported knowledge-base bullets start as “Needs review”. A bullet only goes onto an auto-tailored resume once you mark it <b>Confident</b> — meaning you could explain it in an interview. Edit the wording to match what you actually did, then mark it. Use <b>Excluded</b> for anything you never want used.
      </div>
      <div className="row wrap" style={{ marginBottom: 12 }}>
        {[['prep', `Needs review (${count('prep')})`], ['exclude', `Excluded (${count('exclude')})`], ['confident', `Confident (${count('confident')})`], ['all', 'All']].map(([k, l]) => (
          <button key={k} type="button" className={`btn sm ${filter === k ? 'primary' : ''}`} onClick={() => { setFilter(k); setLimit(30); }}>{l}</button>
        ))}
        <input type="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 240 }} />
        <label className="row gap-s small"><input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />Include archived projects</label>
      </div>
      {shown.slice(0, limit).map((r) => (
        <div key={r.b.id} className="bullet-row" style={{ gridTemplateColumns: '1fr' }}>
          <div className="small muted">{r.label}{r.archived && ' (archived)'}</div>
          <textarea rows={2} value={r.b.text} onChange={(e) => patch(r, { text: e.target.value })} />
          <StatusPicker value={r.b.status} onChange={(s) => patch(r, { status: s })} />
        </div>
      ))}
      {!shown.length && <div className="muted">Nothing to show for this filter.</div>}
      {shown.length > limit && <button type="button" className="btn" onClick={() => setLimit(limit + 30)}>Show more ({shown.length - limit} left)</button>}
    </div>
  );
}
