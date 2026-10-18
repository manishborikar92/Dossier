'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '../../../components/store.js';
import { buildPrep } from '../../../lib/interview.js';

export default function Prep() {
  const { id } = useParams();
  const { data, error } = useStore();
  const resume = data?.resumes.find((r) => r.id === id);
  const prep = useMemo(() => (resume ? buildPrep(data, resume) : null), [data, resume]);
  if (!data) return <div className="page muted">{error || 'Loading…'}</div>;
  if (!resume) return <div className="page">Resume not found. <Link href="/">Back</Link></div>;

  return (
    <main className="page prep">
      <div className="row spread noprint" style={{ marginBottom: 8 }}>
        <Link href={`/resume/${id}`}>← Back to the resume</Link>
        <button className="btn" onClick={() => window.print()}>Print / save as PDF</button>
      </div>
      <h1>Interview prep: {resume.name}</h1>
      <p className="muted">Everything below is generated from what is actually on this resume. If you cannot answer a topic in a sentence or two, either study it or remove it from the resume — an interviewer will find it.</p>

      {prep.unverified.length > 0 && (
        <div className="notice"><b>{prep.unverified.length} item(s) on this resume are not marked Confident:</b>
          <ul>{prep.unverified.slice(0, 8).map((u) => <li key={u.id}>{u.label}: {u.text.slice(0, 90)}{u.text.length > 90 ? '…' : ''}</li>)}</ul>
        </div>
      )}

      <h2>Your projects</h2>
      {prep.projects.map((p) => (
        <div key={p.title} className="card" style={{ marginBottom: 10 }}>
          <b>{p.title}</b>
          <ul>{p.questions.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
      ))}

      <h2 style={{ marginTop: 22 }}>Topics on the resume (most-mentioned first)</h2>
      {prep.topics.map((t) => (
        <div key={t.key} className="card" style={{ marginBottom: 10, breakInside: 'avoid' }}>
          <div className="row spread"><b>{t.label}</b><span className="small muted">appears {t.count}×</span></div>
          <div className="small muted">in: {t.where.slice(0, 4).map((w) => w.label).join(' · ')}</div>
          <ul>{t.questions.map((q) => <li key={q}>{q}</li>)}</ul>
        </div>
      ))}
      {!prep.topics.length && <div className="muted">No recognised topics yet - add content to the resume first.</div>}
    </main>
  );
}
