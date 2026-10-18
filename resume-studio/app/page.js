'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useStore } from '../components/store.js';
import { createResume } from '../components/actions.js';
import { SaveBadge } from '../components/ui.js';
import { TEMPLATES } from '../lib/templates.js';

export default function Dashboard() {
  const store = useStore();
  const { data, update, status, error } = store;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('default');
  const [targetId, setTargetId] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);

  if (error && !data) return <div className="page"><div className="notice err">Could not load your data: {error}</div></div>;
  if (!data) return <div className="page muted">Loading…</div>;

  const bullets = [...data.experience.flatMap((e) => e.bullets), ...data.projects.filter((p) => p.visible !== false).flatMap((p) => p.bullets)];
  const review = bullets.filter((b) => b.status === 'prep').length;
  const confident = bullets.filter((b) => b.status === 'confident').length;

  const create = async () => {
    setBusy(true);
    try {
      const r = await createResume(store, { name: name.trim(), mode, targetId: targetId || data.targets[0]?.id, sourceId: sourceId || data.resumes[0]?.id });
      router.push(`/resume/${r.id}`);
    } finally { setBusy(false); }
  };
  const remove = (r) => { if (confirm(`Delete resume "${r.name}"?`)) update('resumes', (arr) => arr.filter((x) => x.id !== r.id)); };
  const duplicate = (r) => createResume(store, { mode: 'duplicate', sourceId: r.id, name: `${r.name} (copy)` });
  const targetName = (id) => data.targets.find((t) => t.id === id)?.name;

  return (
    <main className="page">
      <div className="row spread" style={{ marginBottom: 16 }}>
        <div><h1>Your resumes</h1><div className="muted">Every resume is a recipe built from your Library, so fixing something once fixes it everywhere.</div></div>
        <div className="row"><SaveBadge status={status} error={error} /><button className="btn primary" onClick={() => setOpen(!open)}>+ New resume</button></div>
      </div>

      {open && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Create a resume</h2>
          <div className="grid two">
            <label className="field"><span>Name</span><input value={name} placeholder="e.g. Acme — Backend Developer" onChange={(e) => setName(e.target.value)} /></label>
            <label className="field"><span>Start from</span>
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="tailor">Auto-tailor for a target (job description)</option>
                <option value="default">My default content</option>
                <option value="duplicate">A copy of an existing resume</option>
              </select>
            </label>
          </div>
          {mode === 'tailor' && (
            <label className="field"><span>Target</span>
              <select value={targetId || data.targets[0]?.id || ''} onChange={(e) => setTargetId(e.target.value)}>
                {data.targets.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              {!data.targets.length && <span className="small muted">Add a target first on the Targets page.</span>}
            </label>
          )}
          {mode === 'duplicate' && (
            <label className="field"><span>Resume to copy</span>
              <select value={sourceId || data.resumes[0]?.id || ''} onChange={(e) => setSourceId(e.target.value)}>
                {data.resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          )}
          <div className="row"><button className="btn primary" disabled={busy || (mode === 'tailor' && !data.targets.length) || (mode === 'duplicate' && !data.resumes.length)} onClick={create}>{busy ? 'Creating…' : 'Create'}</button><button className="btn" onClick={() => setOpen(false)}>Cancel</button></div>
          <p className="small muted" style={{ marginBottom: 0 }}>Auto-tailoring only uses items you marked <b>Confident</b>, then tightens spacing if needed to hit your page target. Nothing is invented.</p>
        </div>
      )}

      <div className="grid cards">
        {data.resumes.map((r) => (
          <div key={r.id} className="card">
            <div className="row spread"><h2 style={{ margin: 0 }}><Link href={`/resume/${r.id}`}>{r.name}</Link></h2><span className="badge info">{TEMPLATES[r.template]?.label || r.template}</span></div>
            <div className="small muted" style={{ margin: '6px 0 10px' }}>
              {r.targetId ? <>Target: {targetName(r.targetId) || 'removed target'}<br /></> : null}
              {r.selection.projects.length} projects · {r.selection.experience.reduce((n, e) => n + e.bullets.length, 0)} experience bullets · edited {new Date(r.updatedAt || r.createdAt).toLocaleDateString()}
            </div>
            <div className="row wrap gap-s">
              <Link className="btn sm primary" href={`/resume/${r.id}`}>Open</Link>
              <a className="btn sm" href={`/api/export/${r.id}?format=docx`}>DOCX</a>
              <a className="btn sm" href={`/api/export/${r.id}?format=pdf`}>PDF</a>
              <Link className="btn sm" href={`/prep/${r.id}`}>Interview prep</Link>
              <button className="btn sm" onClick={() => duplicate(r)}>Duplicate</button>
              <button className="btn sm danger" onClick={() => remove(r)}>Delete</button>
            </div>
          </div>
        ))}
        {!data.resumes.length && <div className="card muted">No resumes yet — click “New resume”.</div>}
      </div>

      <div className="grid cards" style={{ marginTop: 22 }}>
        <div className="card">
          <h2>Library health</h2>
          <div className="row" style={{ gap: 24, marginBottom: 8 }}>
            <div><div className="stat">{confident}</div><div className="small muted">confident bullets</div></div>
            <div><div className="stat" style={{ color: review ? '#8a5a00' : undefined }}>{review}</div><div className="small muted">need review</div></div>
            <div><div className="stat">{data.projects.filter((p) => p.visible !== false).length}</div><div className="small muted">active projects</div></div>
          </div>
          {review > 0 && <p className="small">Bullets marked “needs review” are never used by auto-tailoring. <Link href="/library?tab=review">Review them now →</Link></p>}
        </div>
        <div className="card">
          <h2>Back up or move your data</h2>
          <p className="small muted" style={{ marginTop: 0 }}>Everything lives in the <code>data/</code> folder as plain JSON. Copy that folder to back it up, or download one combined file.</p>
          <a className="btn sm" href="/api/data/_all?download=1">Download backup (JSON)</a>
        </div>
      </div>
    </main>
  );
}
