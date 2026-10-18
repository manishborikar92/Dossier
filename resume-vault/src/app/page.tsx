import Link from 'next/link';
import { Check, Circle } from 'lucide-react';
import { getDb } from '@/server/db';
import { getProfile, listEntities } from '@/server/library';
import { listResumes } from '@/server/resumes';
import { PageHeader } from '@/components/ui';
import { buttonClass } from '@/lib/classes';
import { formatDateTime } from '@/lib/format';
import type { Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const db = getDb();
  const profile = getProfile(db);
  const count = (table: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
  const experiences = count('experiences');
  const education = count('education');
  const skills = count('skills');
  const projects = listEntities<Project>(db, 'projects');
  const activeProjects = projects.filter((p) => p.status === 'active').length;
  const resumes = listResumes(db);
  const unverified = (db.prepare('SELECT COUNT(*) AS n FROM bullets WHERE verified = 0').get() as { n: number }).n;

  const steps = [
    { done: profile.fullName !== '', label: 'Add your name and contact details', href: '/profile' },
    { done: experiences > 0 && education > 0, label: 'Add your experience and education', href: '/career' },
    { done: skills > 0, label: 'Add your skills', href: '/career?tab=skills' },
    { done: projects.length > 0, label: 'Add or import your projects', href: '/projects' },
    { done: resumes.length > 0, label: 'Create your first resume', href: '/resumes' },
  ];
  const remaining = steps.filter((s) => !s.done);
  const attention = resumes.filter((r) => r.outdatedCount > 0);
  const firstName = profile.fullName.split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome to Resume Vault'}
        description="Keep your career information in one place and build a separate, tailored resume from it for each opportunity."
        actions={
          <Link href="/resumes" className={buttonClass('primary')}>
            {resumes.length === 0 ? 'Create a resume' : 'Open resumes'}
          </Link>
        }
      />

      {remaining.length > 0 ? (
        <section aria-labelledby="setup" className="mb-8 rounded-lg border border-rule bg-surface p-5">
          <h2 id="setup" className="font-serif text-lg font-semibold">
            Set up your library
          </h2>
          <p className="mb-3 text-sm text-muted">
            {steps.length - remaining.length} of {steps.length} steps done. Everything you enter here is reused by every resume.
          </p>
          <ol className="space-y-1.5">
            {steps.map((s) => (
              <li key={s.label} className="flex items-center gap-2.5 text-sm">
                {s.done ? <Check className="h-4 w-4 text-ok" aria-label="Done" /> : <Circle className="h-4 w-4 text-muted" aria-label="Not done" />}
                {s.done ? <span className="text-muted line-through">{s.label}</span> : <Link href={s.href} className="font-medium text-navy underline underline-offset-2">{s.label}</Link>}
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted">
            Already have a backup file? Restore it in <Link href="/settings" className="text-navy underline underline-offset-2">Settings &amp; backup</Link>.
          </p>
        </section>
      ) : null}

      <dl className="mb-8 grid grid-cols-2 gap-x-6 gap-y-4 border-y border-rule py-4 sm:grid-cols-4">
        {[
          ['Projects', activeProjects, '/projects'],
          ['Experience entries', experiences, '/career'],
          ['Skills', skills, '/career?tab=skills'],
          ['Resumes', resumes.length, '/resumes'],
        ].map(([label, value, href]) => (
          <div key={label as string}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-serif text-2xl font-semibold">
              <Link href={href as string} className="hover:text-navy">{value}</Link>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="attention">
          <h2 id="attention" className="mb-2 font-serif text-lg font-semibold">
            Needs your attention
          </h2>
          {attention.length === 0 && unverified === 0 ? (
            <p className="rounded-lg border border-rule bg-surface p-4 text-sm text-muted">Nothing to review. Your resumes match your library and every bullet is marked verified.</p>
          ) : (
            <ul className="space-y-2">
              {attention.map((r) => (
                <li key={r.id} className="rounded-lg border border-rule bg-surface p-3 text-sm">
                  <Link href={`/resumes/${r.id}`} className="font-medium text-navy underline underline-offset-2">{r.name}</Link>
                  <span className="text-muted"> has {r.outdatedCount} {r.outdatedCount === 1 ? 'item' : 'items'} where your library has changed since it was copied. Review them in the builder.</span>
                </li>
              ))}
              {unverified > 0 ? (
                <li className="rounded-lg border border-rule bg-surface p-3 text-sm">
                  <Link href="/projects" className="font-medium text-navy underline underline-offset-2">{unverified} {unverified === 1 ? 'bullet' : 'bullets'}</Link>
                  <span className="text-muted"> in your library {unverified === 1 ? 'is' : 'are'} not marked verified. Check them against what you actually did before sending a resume.</span>
                </li>
              ) : null}
            </ul>
          )}
        </section>

        <section aria-labelledby="recent">
          <h2 id="recent" className="mb-2 font-serif text-lg font-semibold">
            Recent resumes
          </h2>
          {resumes.length === 0 ? (
            <p className="rounded-lg border border-rule bg-surface p-4 text-sm text-muted">No resumes yet. Once your library has some content, create one from the Resumes page.</p>
          ) : (
            <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
              {resumes.slice(0, 5).map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/resumes/${r.id}`} className="block truncate font-medium text-navy underline underline-offset-2">{r.name}</Link>
                    <span className="text-xs text-muted">{[r.targetTitle, r.targetCompany].filter(Boolean).join(' at ') || 'No target set'}</span>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{formatDateTime(r.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
