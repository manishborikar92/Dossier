'use client';
import { useMemo } from 'react';
import { Button, Disclosure, EmptyState, Notice, PageSkeleton } from '@/components/ui';
import { useStore } from '@/components/providers/StoreProvider';
import { buildPrep } from '@/lib/domain/interview';
import { plural } from '@/lib/client/format';

export default function PrepView({ id }) {
  const { data, error, reload } = useStore();
  const resume = data?.resumes.find((r) => r.id === id);
  const prep = useMemo(() => (resume ? buildPrep(data, resume) : null), [data, resume]);

  if (!data) {
    return error
      ? <div className="page"><EmptyState icon="alert" title="Could not load your data" action={<Button variant="primary" onClick={reload}>Try again</Button>}>{error}</EmptyState></div>
      : <PageSkeleton />;
  }
  if (!resume) return <div className="page"><EmptyState icon="search" title="Resume not found" action={<Button variant="primary" href="/">Back to your resumes</Button>}>It may have been deleted.</EmptyState></div>;

  const questionCount = prep.topics.reduce((n, t) => n + t.questions.length, 0) + prep.projects.reduce((n, p) => n + p.questions.length, 0);

  return (
    <div className="page prep">
      <div className="prep__bar noprint">
        <Button variant="ghost" icon="chevron-left" href={`/resume/${id}`}>Back to the resume</Button>
        <Button icon="printer" onClick={() => window.print()}>Print or save as PDF</Button>
      </div>
      <header className="page-header"><div>
        <h1>Interview prep</h1>
        <p className="page-header__desc">{resume.name}. {plural(prep.topics.length, 'topic')} and {plural(questionCount, 'question')}, generated from what is on this resume.</p>
      </div></header>
      <p className="prep__lead">If you cannot answer a topic in a sentence or two, either study it or take it off the resume. An interviewer will find it.</p>

      {prep.unverified.length > 0 && (
        <Notice tone="warn" title={`${plural(prep.unverified.length, 'item')} on this resume ${prep.unverified.length === 1 ? 'is' : 'are'} not marked Confident`}>
          <ul className="plain-list">{prep.unverified.slice(0, 8).map((u) => <li key={u.id}>{u.label}: {u.text.slice(0, 90)}{u.text.length > 90 ? '…' : ''}</li>)}</ul>
        </Notice>
      )}

      <section aria-labelledby="pp-h">
        <h2 id="pp-h" className="section-title">Your projects</h2>
        {prep.projects.map((p) => (
          <div key={p.title} className="qblock">
            <h3>{p.title}</h3>
            <ol>{p.questions.map((q) => <li key={q}>{q}</li>)}</ol>
          </div>
        ))}
        {!prep.projects.length && <p className="muted">This resume has no projects.</p>}
      </section>

      <section aria-labelledby="pt-h">
        <h2 id="pt-h" className="section-title">Topics on the resume</h2>
        <p className="muted">Most-mentioned first.</p>
        {prep.topics.map((t) => (
          <Disclosure key={t.key} defaultOpen title={t.label} count={`${t.count}x`} className="qtopic">
            <p className="muted">Appears in: {t.where.slice(0, 4).map((w) => w.label).join(', ')}</p>
            <ul className="plain-list">{t.questions.map((q) => <li key={q}>{q}</li>)}</ul>
          </Disclosure>
        ))}
        {!prep.topics.length && <p className="muted">No recognised topics yet. Add content to the resume first.</p>}
      </section>
    </div>
  );
}
