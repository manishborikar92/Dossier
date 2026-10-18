'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../components/store.js';
import { createResume } from '../../components/actions.js';
import { TagsInput } from '../../components/Editor.js';
import { Field, SaveBadge } from '../../components/ui.js';
import { analyzeJD, tailor } from '../../lib/tailor.js';
import { uid } from '../../lib/ids.js';

const WHERE = { available: ['warn', 'in your library, not selected'], 'needs-review': ['warn', 'needs review'], excluded: ['mute', 'excluded by you'], absent: ['bad', 'not in your library'] };

export default function Targets() {
  const store = useStore();
  const { data, update, status, error } = store;
  const router = useRouter();
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => { if (data && sel === null) setSel(data.targets[0]?.id ?? null); }, [data, sel]);
  const target = data?.targets.find((t) => t.id === sel) || null;
  const set = (patch) => update('targets', (arr) => arr.map((t) => (t.id === sel ? { ...t, ...patch } : t)));
  const kws = useMemo(() => (target ? analyzeJD(target.jd, target.keywords) : []), [target]);
  const plan = useMemo(() => (data && target ? tailor(data, target) : null), [data, target]);

  if (!data) return <div className="page muted">{error || 'Loading…'}</div>;

  const add = () => { const t = { id: uid('target'), name: 'New target', kind: 'job', company: '', jd: '', keywords: [], focusProjectIds: [], notes: '' }; update('targets', (arr) => [...arr, t]); setSel(t.id); };
  const remove = () => { if (confirm(`Delete target "${target.name}"? Resumes that used it are kept.`)) { update('targets', (arr) => arr.filter((t) => t.id !== sel)); setSel(null); } };
  const make = async () => {
    setBusy(true);
    try { const r = await createResume(store, { mode: 'tailor', targetId: target.id, name: name.trim() || `${target.name} — tailored` }); router.push(`/resume/${r.id}`); } finally { setBusy(false); }
  };
  const projects = data.projects.filter((p) => p.visible !== false);
  const toggleFocus = (id) => set({ focusProjectIds: target.focusProjectIds.includes(id) ? target.focusProjectIds.filter((x) => x !== id) : [...target.focusProjectIds, id] });

  return (
    <main className="page">
      <div className="row spread" style={{ marginBottom: 12 }}>
        <div><h1>Targets</h1><div className="muted">A target is a job description or a focus (e.g. “lead with my 3D work”). Paste it in and see what your Library can honestly offer.</div></div>
        <SaveBadge status={status} error={error} />
      </div>
      <div className="split">
        <div>
          <div className="list">
            {data.targets.map((t) => <button key={t.id} className={t.id === sel ? 'on' : ''} onClick={() => setSel(t.id)}><div>{t.name || '(untitled)'}</div><div className="small muted">{t.kind === 'focus' ? 'focus' : 'job'}{t.company ? ` · ${t.company}` : ''}</div></button>)}
            {!data.targets.length && <div className="muted small" style={{ padding: 12 }}>No targets yet.</div>}
          </div>
          <div style={{ marginTop: 8 }}><button className="btn sm" onClick={add}>+ Add target</button></div>
        </div>

        {target ? (
          <div className="grid">
            <div className="card">
              <div className="grid two">
                <Field label="Name"><input value={target.name} onChange={(e) => set({ name: e.target.value })} /></Field>
                <Field label="Company (optional)"><input value={target.company} onChange={(e) => set({ company: e.target.value })} /></Field>
              </div>
              <Field label="Type"><select value={target.kind} onChange={(e) => set({ kind: e.target.value })}><option value="job">Job / opportunity (paste the job description)</option><option value="focus">Focus (highlight chosen projects)</option></select></Field>
              <Field label="Job description or notes" hint="Paste the full text. Keywords are detected from a built-in technology dictionary - no AI, no network."><textarea rows={12} value={target.jd} onChange={(e) => set({ jd: e.target.value })} /></Field>
              <Field label="Must-have keywords (comma separated, optional)" hint="Weighted higher when matching. Anything not in the dictionary is matched as plain text."><TagsInput key={target.id} value={target.keywords} onChange={(k) => set({ keywords: k })} /></Field>
              <div className="small muted" style={{ marginBottom: 6 }}>Always feature these projects</div>
              <div style={{ maxHeight: 170, overflow: 'auto', border: '1px solid #eef0f3', borderRadius: 8, padding: '4px 10px' }}>
                {projects.map((p) => <label key={p.id} className="row gap-s" style={{ padding: '2px 0' }}><input type="checkbox" checked={target.focusProjectIds.includes(p.id)} onChange={() => toggleFocus(p.id)} />{p.title}{!p.bullets.some((b) => b.status === 'confident') && <span className="badge prep">no confident bullets</span>}</label>)}
              </div>
              <div className="row" style={{ marginTop: 12 }}><button className="btn danger sm" onClick={remove}>Delete target</button></div>
            </div>

            <div className="card">
              <h2>What your Library can offer</h2>
              {!kws.length ? <div className="muted">Paste a job description above to see matching keywords.</div> : (
                <>
                  <div className="row spread small" style={{ marginBottom: 4 }}><span>Keyword coverage with an auto-tailored resume</span><b>{plan.report.pct}%</b></div>
                  <div className="bar"><i style={{ width: `${plan.report.pct}%` }} /></div>
                  <h3 style={{ marginTop: 14 }}>Covered</h3>
                  <div>{plan.report.matched.map((k) => <span key={k.key} className="chip good">{k.label}</span>)}{!plan.report.matched.length && <span className="muted small">none yet</span>}</div>
                  <h3 style={{ marginTop: 10 }}>Not on the tailored resume</h3>
                  <div>{plan.report.missing.map((k) => <span key={k.key} className={`chip ${WHERE[k.where][0]}`} title={WHERE[k.where][1]}>{k.label} · {WHERE[k.where][1]}</span>)}{!plan.report.missing.length && <span className="muted small">nothing - full coverage</span>}</div>
                  <p className="small muted">Be honest with yourself about the missing ones: only add a skill if you could answer a basic question on it. Learning it first is a perfectly good plan.</p>
                  <h3>Projects it would feature</h3>
                  <ol style={{ marginTop: 4 }}>{plan.selection.projects.map((p) => <li key={p.id}>{data.projects.find((x) => x.id === p.id)?.title}</li>)}</ol>
                  {plan.report.skippedProjects > 0 && <div className="notice small">{plan.report.skippedProjects} active projects were skipped because none of their bullets are marked Confident yet. Review them in Library → Review queue if you want them considered.</div>}
                </>
              )}
              <div className="row wrap" style={{ marginTop: 12 }}>
                <input style={{ maxWidth: 320 }} placeholder={`${target.name} — tailored`} value={name} onChange={(e) => setName(e.target.value)} />
                <button className="btn primary" disabled={busy} onClick={make}>{busy ? 'Creating…' : 'Create tailored resume'}</button>
              </div>
            </div>
          </div>
        ) : <div className="card muted">Add a target to get started.</div>}
      </div>
    </main>
  );
}
