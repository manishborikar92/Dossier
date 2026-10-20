'use client';
import { useId, useState } from 'react';
import { Badge, Button, Check, EmptyState, MeterBar, Segmented, StatusPicker } from '@/components/ui';

/** One place to review every bullet you have not yet confirmed. Rows you just changed stay put until you change the filter. */
export default function ReviewQueue({ data, update }) {
  const searchId = useId();
  const [filter, setFilter] = useState('prep');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(25);
  const [showArchived, setShowArchived] = useState(false);
  const [kept, setKept] = useState(() => new Set());
  const reset = () => { setKept(new Set()); setLimit(25); };

  const rows = [];
  for (const e of data.experience) for (const b of e.bullets) rows.push({ col: 'experience', owner: e.id, label: `${e.title}, ${e.company}`, b });
  for (const p of data.projects) {
    if (p.visible === false && !showArchived) continue;
    for (const b of p.bullets) rows.push({ col: 'projects', owner: p.id, label: p.title, b, archived: p.visible === false });
  }
  const count = (s) => rows.filter((r) => r.b.status === s).length;
  const textOk = (r) => !q || `${r.label} ${r.b.text}`.toLowerCase().includes(q.toLowerCase());
  const shown = rows.filter((r) => textOk(r) && ((filter === 'all' || r.b.status === filter) || kept.has(r.b.id)));

  const patch = (r, p) => {
    if ('status' in p) setKept((k) => new Set(k).add(r.b.id));
    update(r.col, (arr) => arr.map((o) => (o.id !== r.owner ? o : { ...o, bullets: o.bullets.map((x) => (x.id === r.b.id ? { ...x, ...p } : x)) })));
  };

  return (
    <div className="rqueue">
      <div className="rqueue__summary">
        <MeterBar label={`${count('confident')} confident, ${count('prep')} need review, ${count('exclude')} excluded`} segments={[{ tone: 'ok', value: count('confident') }, { tone: 'hl', value: count('prep') }, { tone: 'no', value: count('exclude') }]} />
        <p>{count('confident')} of {rows.length} bullets confirmed. Reword a bullet to match what you actually did, then mark it Confident. Use Excluded for anything you never want on a resume.</p>
      </div>
      <div className="toolbar">
        <Segmented
          label="Show bullets" value={filter} onChange={(v) => { setFilter(v); reset(); }}
          options={[{ value: 'prep', label: `Needs review ${count('prep')}` }, { value: 'confident', label: `Confident ${count('confident')}` }, { value: 'exclude', label: `Excluded ${count('exclude')}` }, { value: 'all', label: 'All' }]}
        />
        <div className="searchbox searchbox--inline">
          <label htmlFor={searchId} className="sr-only">Search bullets</label>
          <input id={searchId} className="input" type="search" placeholder="Search bullets" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
        </div>
        <Check label="Include archived projects" checked={showArchived} onChange={(c) => { setShowArchived(c); reset(); }} />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="check" title={filter === 'prep' && !q ? 'Nothing left to review' : 'No bullets match'}>
          {filter === 'prep' && !q ? 'Every bullet has been confirmed or excluded. Nice work.' : 'Try another filter or search.'}
        </EmptyState>
      ) : (
        <ul className="rqueue__list">
          {shown.slice(0, limit).map((r) => (
            <li key={r.b.id} className={`rq rq--${r.b.status}`}>
              <div className="rq__ctx">{r.label}{r.archived && <Badge>Archived project</Badge>}</div>
              <textarea className="textarea" rows={2} aria-label={`Bullet from ${r.label}`} value={r.b.text} onChange={(e) => patch(r, { text: e.target.value })} />
              <StatusPicker value={r.b.status} label={`Status for a bullet from ${r.label}`} onChange={(s) => patch(r, { status: s })} />
            </li>
          ))}
        </ul>
      )}
      {shown.length > limit && <Button onClick={() => setLimit(limit + 25)}>Show {Math.min(25, shown.length - limit)} more ({shown.length - limit} left)</Button>}
    </div>
  );
}
