'use client';

import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import type { ResumeMatch } from '@/server/resumes';
import type { ResumeRecord } from '@/lib/types';
import { Badge, Button, Spinner, TextArea, useToast } from '../ui';

interface Props {
  resume: ResumeRecord;
  mutate: (action: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
}

export function MatchTab({ resume, mutate }: Props) {
  const toast = useToast();
  const [jd, setJd] = useState(resume.jdText);
  const [match, setMatch] = useState<ResumeMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Show results for the saved job description when the tab opens or the resume changes.
  useEffect(() => {
    let cancelled = false;
    api<ResumeMatch>(`/api/resumes/${resume.id}/match`)
      .then((m) => {
        if (cancelled) return;
        setMatch(m);
        setSelected(new Set(Object.entries(m.projectsInResume).filter(([, inc]) => inc).map(([id]) => Number(id))));
      })
      .catch((e) => toast.error(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [resume.id, resume.updatedAt, toast]);

  async function analyse() {
    setLoading(true);
    // Saving the text refreshes the resume, which in turn reloads the analysis below.
    await mutate(() => api(`/api/resumes/${resume.id}`, { method: 'PATCH', body: { jdText: jd } }));
    setLoading(false);
  }

  const result = match?.result;
  const projectsIn = match?.projectsInResume ?? {};
  const skillsIn = match?.skillsInResume ?? {};
  const toggle = (id: number) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <div>
        <TextArea label="Job description" rows={8} value={jd} onChange={setJd} hint="Paste the posting. The analysis only looks at your own library: it ranks and highlights what you already have, and never adds anything you have not done." />
        <div className="mt-2 flex items-center gap-3">
          <Button variant="primary" loading={loading} onClick={analyse} disabled={jd.trim() === ''}>
            Save and analyse
          </Button>
          {jd !== resume.jdText && jd.trim() !== '' ? <span className="text-xs text-muted">Not analysed yet</span> : null}
        </div>
      </div>

      {!match ? <Spinner /> : null}
      {match && result && !result.hasJobDescription ? <p className="text-sm text-muted">Paste a job description above to see which of your projects and skills fit it best.</p> : null}

      {result?.hasJobDescription ? (
        <>
          <section aria-labelledby="m-projects">
            <h3 id="m-projects" className="mb-1 font-serif text-base font-semibold">Projects ranked for this job</h3>
            <p className="mb-2 text-sm text-muted">A technology listed on a project counts more than a mention in its text. You decide what goes on the resume.</p>
            {result.projects.length === 0 ? (
              <p className="rounded-md bg-paper p-3 text-sm text-muted">None of your active projects mention terms from this job description.</p>
            ) : (
              <>
                <ul className="space-y-2">
                  {result.projects.map((p) => (
                    <li key={p.id} className="rounded-lg border border-rule bg-surface p-3">
                      <label className="flex items-start gap-2.5">
                        <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="mt-1 h-4 w-4 accent-navy" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2 text-sm font-medium">
                            {p.name}
                            <span className="text-xs font-normal text-muted">{p.percent}% match</span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded bg-navy-soft" aria-hidden>
                            <span className="block h-full bg-navy" style={{ width: `${p.percent}%` }} />
                          </span>
                          <span className="mt-1 block text-xs text-muted">Matches: {p.terms.join(', ')}</span>
                          {projectsIn[p.id] === undefined ? <span className="mt-1 block text-xs text-muted">Not on this resume yet</span> : projectsIn[p.id] ? <span className="mt-1 block text-xs text-ok">On this resume</span> : <span className="mt-1 block text-xs text-muted">On this resume but hidden</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setSelected(new Set(result.projects.slice(0, 3).map((p) => p.id)))}>Select the top three</Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => mutate(() => api(`/api/resumes/${resume.id}/match/apply`, { body: { projectIds: [...selected] } }), 'Projects updated on this resume.')}
                  >
                    Show only the selected projects
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted">Projects that are not ticked are hidden on this resume, not deleted.</p>
              </>
            )}
          </section>

          <section aria-labelledby="m-matched">
            <h3 id="m-matched" className="mb-1 font-serif text-base font-semibold">In the job description, and in your library</h3>
            {result.matched.length === 0 ? (
              <p className="text-sm text-muted">No recognised skills or technologies from the posting appear in your library.</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {result.matched.map((m) => (
                  <li key={m.canon}>
                    <Badge tone="ok" title={`Found in: ${m.evidence.map((e) => e.name).join('; ')}`}>
                      {m.label}
                      {m.count > 1 ? ` \u00d7${m.count}` : ''}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="m-gaps">
            <h3 id="m-gaps" className="mb-1 font-serif text-base font-semibold">In the job description, but not in your library</h3>
            {result.gaps.length === 0 ? (
              <p className="text-sm text-muted">No gaps found among the terms this tool recognises.</p>
            ) : (
              <>
                <ul className="flex flex-wrap gap-1.5">
                  {result.gaps.map((g) => (
                    <li key={g.canon}>
                      <Badge tone="warn">{g.label}</Badge>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-sm text-muted">Nothing in your library mentions these. They are not added to your resume. Only add one if you genuinely have the experience, by recording it in your library first.</p>
              </>
            )}
          </section>

          <section aria-labelledby="m-skills">
            <h3 id="m-skills" className="mb-1 font-serif text-base font-semibold">Your skills that fit</h3>
            {result.skills.length === 0 ? (
              <p className="text-sm text-muted">None of your listed skills match the posting.</p>
            ) : (
              <ul className="space-y-1">
                {result.skills.map((s) => {
                  const inResume = skillsIn[s.id];
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                      <span>
                        {s.name} <span className="text-xs text-muted">({s.term})</span>
                      </span>
                      {inResume === undefined ? (
                        <Button size="sm" onClick={() => mutate(() => api(`/api/resumes/${resume.id}/items`, { body: { sourceType: 'skill', sourceId: s.id } }), 'Skill added.')}>
                          <Plus className="h-3.5 w-3.5" aria-hidden />
                          Add to resume
                        </Button>
                      ) : inResume ? (
                        <Badge tone="ok">On resume</Badge>
                      ) : (
                        <Badge>Hidden on resume</Badge>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {result.experiences.length > 0 ? (
            <section aria-labelledby="m-exp">
              <h3 id="m-exp" className="mb-1 font-serif text-base font-semibold">Most relevant roles</h3>
              <ul className="space-y-1 text-sm">
                {result.experiences.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    {e.title} at {e.org} <span className="text-xs text-muted">({e.terms.join(', ')})</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
