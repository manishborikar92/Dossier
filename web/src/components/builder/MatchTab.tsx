'use client';

import { Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { ResumeMatch, ResumeRecord } from '@/lib/types';
import { Badge, Button, Notice, Spinner, TextArea, useToast } from '../ui';
import type { Mutate } from './types';

function Block({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h3 id={id} className="text-ink mb-2 text-sm font-semibold tracking-tight">
        {title}
      </h3>
      {children}
    </section>
  );
}

export function MatchTab({ resume, mutate }: { resume: ResumeRecord; mutate: Mutate }) {
  const toast = useToast();
  const [jd, setJd] = useState(resume.jdText);
  const [match, setMatch] = useState<ResumeMatch | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Show results for the saved job description when the tab opens or the resume changes.
  useEffect(() => {
    let cancelled = false;
    api.resumes
      .match(resume.id)
      .then((m) => {
        if (cancelled) return;
        setMatch(m);
        setSelected(
          new Set(
            Object.entries(m.projectsInResume)
              .filter(([, included]) => included)
              .map(([id]) => Number(id)),
          ),
        );
      })
      .catch((e) => toast.error(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [resume.id, resume.updatedAt, toast]);

  async function analyse() {
    setLoading(true);
    // Saving the text refreshes the resume, which in turn reloads the analysis above.
    await mutate(() => api.resumes.update(resume.id, { jdText: jd }));
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
    <div className="space-y-7">
      <div>
        <TextArea
          label="Job description"
          rows={8}
          value={jd}
          onChange={setJd}
          hint="Paste the posting. The analysis only looks at your own library: it ranks and highlights what you already have, and never adds anything you have not done."
        />
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" loading={loading} onClick={analyse} disabled={jd.trim() === ''}>
            Save and analyse
          </Button>
          {jd !== resume.jdText && jd.trim() !== '' ? <span className="text-muted text-xs">Not analysed yet</span> : null}
        </div>
      </div>

      {!match ? <Spinner /> : null}
      {match && result && !result.hasJobDescription ? (
        <p className="text-muted text-sm">Paste a job description above to see which of your projects and skills fit it best.</p>
      ) : null}

      {result?.hasJobDescription ? (
        <>
          <Block id="m-projects" title="Projects ranked for this job">
            <p className="text-muted mb-3 text-sm">
              A technology listed on a project counts more than a mention in its text. You decide what goes on the resume.
            </p>
            {result.projects.length === 0 ? (
              <Notice>None of your active projects mention terms from this job description.</Notice>
            ) : (
              <>
                <ul className="space-y-2">
                  {result.projects.map((p) => (
                    <li key={p.id} className="border-line bg-surface rounded-lg border p-3">
                      <label className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                          className="accent-brand mt-1 size-4"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="text-ink flex items-center justify-between gap-2 text-sm font-medium">
                            {p.name}
                            <span className="text-muted text-xs font-normal tabular-nums">{p.percent}% match</span>
                          </span>
                          <span className="bg-line mt-1.5 block h-1.5 overflow-hidden rounded-full" aria-hidden>
                            <span className="bg-brand block h-full rounded-full" style={{ width: `${p.percent}%` }} />
                          </span>
                          <span className="text-muted mt-1.5 block text-xs">Matches: {p.terms.join(', ')}</span>
                          <span className="mt-1 block text-xs">
                            {projectsIn[p.id] === undefined ? (
                              <span className="text-muted">Not on this resume yet</span>
                            ) : projectsIn[p.id] ? (
                              <span className="text-ok font-medium">On this resume</span>
                            ) : (
                              <span className="text-muted">On this resume but hidden</span>
                            )}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => setSelected(new Set(result.projects.slice(0, 3).map((p) => p.id)))}>
                    Select the top three
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => mutate(() => api.resumes.applyProjects(resume.id, [...selected]), 'Projects updated on this resume.')}
                  >
                    Show only the selected projects
                  </Button>
                </div>
                <p className="text-muted mt-1.5 text-xs">Projects that are not ticked are hidden on this resume, not deleted.</p>
              </>
            )}
          </Block>

          <Block id="m-matched" title="In the job description, and in your library">
            {result.matched.length === 0 ? (
              <p className="text-muted text-sm">No recognised skills or technologies from the posting appear in your library.</p>
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
          </Block>

          <Block id="m-gaps" title="In the job description, but not in your library">
            {result.gaps.length === 0 ? (
              <p className="text-muted text-sm">No gaps found among the terms this tool recognises.</p>
            ) : (
              <>
                <ul className="flex flex-wrap gap-1.5">
                  {result.gaps.map((g) => (
                    <li key={g.canon}>
                      <Badge tone="warn">{g.label}</Badge>
                    </li>
                  ))}
                </ul>
                <p className="text-muted mt-2 text-sm">
                  Nothing in your library mentions these. They are not added to your resume. Only add one if you genuinely have the
                  experience, by recording it in your library first.
                </p>
              </>
            )}
          </Block>

          <Block id="m-skills" title="Your skills that fit">
            {result.skills.length === 0 ? (
              <p className="text-muted text-sm">None of your listed skills match the posting.</p>
            ) : (
              <ul className="divide-line border-line bg-surface divide-y rounded-lg border">
                {result.skills.map((s) => {
                  const inResume = skillsIn[s.id];
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>
                        {s.name} <span className="text-muted text-xs">({s.term})</span>
                      </span>
                      {inResume === undefined ? (
                        <Button
                          size="sm"
                          onClick={() =>
                            mutate(() => api.resumes.addItem(resume.id, { sourceType: 'skill', sourceId: s.id }), 'Skill added.')
                          }
                        >
                          <Plus className="size-3.5" aria-hidden />
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
          </Block>

          {result.experiences.length > 0 ? (
            <Block id="m-exp" title="Most relevant roles">
              <ul className="space-y-1 text-sm">
                {result.experiences.slice(0, 4).map((e) => (
                  <li key={e.id}>
                    {e.title} at {e.org} <span className="text-muted text-xs">({e.terms.join(', ')})</span>
                  </li>
                ))}
              </ul>
            </Block>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
