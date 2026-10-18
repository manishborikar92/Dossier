'use client';
import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useStore, api } from '../../components/store.js';
import { CollectionEditor, ProfileEditor } from '../../components/Editor.js';
import ReviewQueue from '../../components/ReviewQueue.js';
import { SaveBadge } from '../../components/ui.js';
import { uid } from '../../lib/ids.js';

const reviewCount = (bullets = []) => bullets.filter((b) => b.status !== 'confident').length;
const meta = (bullets) => { const n = reviewCount(bullets); return `${bullets.length} bullets${n ? ` · ${n} to review` : ''}`; };

const SPECS = {
  summaries: {
    noun: 'summary', label: (s) => s.label, meta: (s) => s.status,
    newItem: () => ({ id: uid('sum'), label: 'New summary', text: '', status: 'confident' }),
    fields: [
      { key: 'label', type: 'text', label: 'Label (only you see this)' },
      { key: 'text', type: 'textarea', label: 'Summary text', rows: 7 },
      { key: 'status', type: 'status', label: 'Can you stand behind every claim in it?' },
    ],
  },
  experience: {
    noun: 'job', label: (e) => `${e.title} — ${e.company}`, meta: (e) => `${e.dates} · ${meta(e.bullets)}`,
    newItem: () => ({ id: uid('exp'), company: '', title: '', location: '', dates: '', visible: true, bullets: [] }),
    fields: [
      { key: 'title', type: 'text', label: 'Role title' }, { key: 'company', type: 'text', label: 'Company' },
      { key: 'location', type: 'text', label: 'Location' }, { key: 'dates', type: 'text', label: 'Dates (shown exactly as typed)' },
      { key: 'visible', type: 'bool', label: 'Available in the resume composer' },
      { key: 'bullets', type: 'bullets', label: 'Bullets' },
    ],
  },
  skills: {
    noun: 'skill group', label: (g) => g.label, meta: (g) => `${g.items.length} skills`,
    newItem: () => ({ id: uid('sk'), label: 'New group', items: [] }),
    fields: [
      { key: 'label', type: 'text', label: 'Group name (e.g. Languages)' },
      { key: 'items', type: 'skillitems', label: 'Skills' },
    ],
  },
  projects: {
    noun: 'project', searchable: true, dim: (p) => p.visible === false,
    label: (p) => p.title, meta: (p) => `${p.ownership}${p.year ? ` · ${p.year}` : ''} · ${meta(p.bullets)}${p.visible === false ? ' · archived' : ''}`,
    newItem: () => ({ id: uid('proj'), title: '', ownership: 'personal', link: '', year: '', techStack: [], tags: [], visible: true, notes: '', kb: null, bullets: [] }),
    fields: [
      { key: 'title', type: 'text', label: 'Project title' },
      { key: 'ownership', type: 'select', label: 'Type', options: [{ value: 'company', label: 'Company / employer' }, { value: 'freelance', label: 'Freelance / client' }, { value: 'college', label: 'College' }, { value: 'personal', label: 'Personal' }], hint: 'Drives the optional “College Project” style labels. Company repos are usually private - do not link them.' },
      { key: 'link', type: 'text', label: 'Link shown on the resume (optional)' },
      { key: 'year', type: 'text', label: 'Year / dates (shown as typed)' },
      { key: 'techStack', type: 'tags', label: 'Tech stack shown on the resume (comma separated)', hint: 'Only list what you are comfortable being asked about.' },
      { key: 'visible', type: 'bool', label: 'Active (untick to archive - archived projects are hidden in the composer)' },
      {
        key: 'kbinfo', type: 'info',
        render: (p) => !p.kb ? null : (
          <div className="notice info small" style={{ marginBottom: 12 }}>
            <div><b>Knowledge base:</b> rank #{p.kb.rank} · score {p.kb.score}/100 · {p.kb.commitCount} commits{p.kb.liveUrl ? <> · <a href={p.kb.liveUrl} target="_blank" rel="noreferrer">live site</a></> : null}</div>
            {p.kb.purpose && <div style={{ marginTop: 4 }}>{p.kb.purpose}</div>}
            {p.kb.techNotListed?.length > 0 && <div style={{ marginTop: 6 }}><b>Listed in the knowledge base but not in your stack/bullets:</b> {p.kb.techNotListed.join(', ')}. Verify before adding any of these.</div>}
          </div>
        ),
      },
      { key: 'notes', type: 'textarea', label: 'Private notes (never exported)', rows: 2 },
      { key: 'bullets', type: 'bullets', label: 'Bullets' },
    ],
  },
  education: {
    noun: 'education entry', label: (e) => e.degree, meta: (e) => e.dates,
    newItem: () => ({ id: uid('edu'), degree: '', institution: '', dates: '', detail: '' }),
    fields: [
      { key: 'degree', type: 'text', label: 'Degree / qualification' }, { key: 'institution', type: 'text', label: 'Institution' },
      { key: 'dates', type: 'text', label: 'Date (shown as typed)' }, { key: 'detail', type: 'text', label: 'Grade / CGPA / percentage' },
    ],
  },
  certifications: {
    noun: 'certification', label: (c) => c.text.slice(0, 60), meta: (c) => c.status,
    newItem: () => ({ id: uid('cert'), text: '', status: 'confident' }),
    fields: [{ key: 'text', type: 'textarea', label: 'Certification (as it should read)', rows: 2 }, { key: 'status', type: 'status', label: 'Status' }],
  },
  involvement: {
    noun: 'activity', label: (e) => e.role, meta: (e) => e.dates,
    newItem: () => ({ id: uid('inv'), role: '', org: '', dates: '', text: '' }),
    fields: [
      { key: 'role', type: 'text', label: 'Role' }, { key: 'org', type: 'text', label: 'Organisation' },
      { key: 'dates', type: 'text', label: 'Dates' }, { key: 'text', type: 'textarea', label: 'One-line description (optional)', rows: 2 },
    ],
  },
};

const TABS = [['review', 'Review queue'], ['profile', 'Profile'], ['summaries', 'Summaries'], ['experience', 'Experience'], ['skills', 'Skills'], ['projects', 'Projects'], ['education', 'Education'], ['certifications', 'Certifications'], ['involvement', 'Involvement']];

function Library() {
  const store = useStore();
  const { data, update, status, error, reload } = store;
  const initial = useSearchParams().get('tab');
  const [tab, setTab] = useState(TABS.some(([k]) => k === initial) ? initial : 'review');
  const [msg, setMsg] = useState(null);

  if (!data) return <div className="page muted">{error || 'Loading…'}</div>;

  const importKb = async (file) => {
    try {
      const body = file ? await file.text() : '';
      await store.flush();
      const s = await api('/api/import-kb', { method: 'POST', body });
      await reload();
      setMsg({ ok: true, text: `Knowledge base merged: ${s.added} new projects, ${s.updated} existing updated, ${s.bulletsAdded} new bullets added as “needs review”. Nothing you wrote was overwritten.` });
    } catch (e) { setMsg({ ok: false, text: e.message }); }
  };

  return (
    <main className="page">
      <div className="row spread" style={{ marginBottom: 12 }}>
        <div><h1>Library</h1><div className="muted">Write things once. Every resume pulls from here.</div></div>
        <SaveBadge status={status} error={error} />
      </div>
      {msg && <div className={`notice ${msg.ok ? 'ok' : 'err'}`}>{msg.text}</div>}
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'review' && <ReviewQueue data={data} update={update} />}
      {tab === 'profile' && <ProfileEditor profile={data.profile} onChange={(p) => update('profile', p)} />}
      {tab !== 'review' && tab !== 'profile' && (
        <CollectionEditor key={tab} items={data[tab]} onChange={(items) => update(tab, items)} spec={SPECS[tab]} />
      )}
      {tab === 'projects' && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Knowledge base</h3>
          <p className="small muted" style={{ marginTop: 0 }}>Re-import after your knowledge base changes. It only adds new projects and new bullets (as “needs review”) and refreshes the read-only knowledge-base panel. Your edits are never overwritten.</p>
          <div className="row wrap">
            <button className="btn sm" onClick={() => importKb(null)}>Re-import bundled file (seed/project_knowledge_base.json)</button>
            <label className="btn sm">Import a different file…<input type="file" accept=".json,application/json" hidden onChange={(e) => e.target.files[0] && importKb(e.target.files[0])} /></label>
          </div>
        </div>
      )}
    </main>
  );
}

export default function Page() {
  return <Suspense fallback={<div className="page muted">Loading…</div>}><Library /></Suspense>;
}
