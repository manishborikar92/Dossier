import { AlertTriangle, ArrowRight, Briefcase, Check, CheckCircle2, FileText, FolderGit2, Plus, Sparkles, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Badge, Card, ProgressBar, SectionCard, PageHeader, buttonClass } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { getDb } from '@/server/db';
import { getDashboardData } from '@/server/stats';

export default function DashboardPage() {
  const { profile, counts, unverifiedBullets, resumes, needsReview, steps } = getDashboardData(getDb());
  const remaining = steps.filter((s) => !s.done);
  const firstName = profile.fullName.split(' ')[0];

  const tiles = [
    { label: 'Projects', value: counts.projects, href: '/projects', icon: FolderGit2 },
    { label: 'Experience entries', value: counts.experiences, href: '/career', icon: Briefcase },
    { label: 'Skills', value: counts.skills, href: '/career?tab=skills', icon: Wrench },
    { label: 'Resumes', value: counts.resumes, href: '/resumes', icon: FileText },
  ];

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome to Resume Vault'}
        description="Keep your career information in one place and build a separate, tailored resume from it for each opportunity."
        actions={
          <>
            <Link href="/projects/new" className={buttonClass('secondary')}>
              <Plus className="size-4" aria-hidden />
              Add project
            </Link>
            <Link href="/resumes" className={buttonClass('primary')}>
              <FileText className="size-4" aria-hidden />
              {resumes.length === 0 ? 'Create a resume' : 'Open resumes'}
            </Link>
          </>
        }
      />

      <ul className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, href, icon: Icon }) => (
          <li key={label}>
            <Link
              href={href}
              className="group border-line bg-surface shadow-card hover:border-brand-line flex items-center gap-3.5 rounded-xl border p-4 transition-colors"
            >
              <span className="bg-brand-soft text-brand flex size-10 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" aria-hidden />
              </span>
              <span>
                <span className="text-ink block text-2xl leading-none font-semibold tracking-tight tabular-nums">{value}</span>
                <span className="text-muted mt-1 block text-[13px]">{label}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-6">
          <SectionCard title="Needs your attention" description="Things worth a look before you send a resume.">
            {needsReview.length === 0 && unverifiedBullets === 0 ? (
              <p className="text-ok flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="size-4" aria-hidden />
                All clear. Your resumes match your library and every bullet is marked verified.
              </p>
            ) : (
              <ul className="divide-line -my-1 divide-y">
                {needsReview.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 py-3">
                    <AlertTriangle className="text-warn mt-0.5 size-4 shrink-0" aria-hidden />
                    <p className="text-ink-2 min-w-0 flex-1 text-sm">
                      <Link href={`/resumes/${r.id}`} className="link font-medium">
                        {r.name}
                      </Link>{' '}
                      has {r.outdatedCount} {r.outdatedCount === 1 ? 'item' : 'items'} where your library has changed since it was copied.
                    </p>
                    <Link href={`/resumes/${r.id}`} className={buttonClass('secondary', 'sm')}>
                      Review
                    </Link>
                  </li>
                ))}
                {unverifiedBullets > 0 ? (
                  <li className="flex items-start gap-3 py-3">
                    <AlertTriangle className="text-warn mt-0.5 size-4 shrink-0" aria-hidden />
                    <p className="text-ink-2 min-w-0 flex-1 text-sm">
                      <span className="font-medium">
                        {unverifiedBullets} {unverifiedBullets === 1 ? 'bullet' : 'bullets'}
                      </span>{' '}
                      in your library {unverifiedBullets === 1 ? 'is' : 'are'} not marked verified. Check them against what you actually did
                      before sending a resume.
                    </p>
                    <Link href="/projects" className={buttonClass('secondary', 'sm')}>
                      Open projects
                    </Link>
                  </li>
                ) : null}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Recent resumes"
            action={
              resumes.length > 0 ? (
                <Link href="/resumes" className="link text-sm font-medium">
                  View all
                </Link>
              ) : undefined
            }
            bodyClassName="p-0"
          >
            {resumes.length === 0 ? (
              <p className="text-muted px-5 py-4 text-sm">
                No resumes yet. Once your library has some content, create one from the Resumes page.
              </p>
            ) : (
              <ul className="divide-line divide-y">
                {resumes.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link href={`/resumes/${r.id}`} className="hover:bg-sunken flex items-center gap-3 px-5 py-3.5">
                      <span className="bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-lg">
                        <FileText className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-ink block truncate text-sm font-medium">{r.name}</span>
                        <span className="text-muted block truncate text-xs">
                          {[r.targetTitle, r.targetCompany].filter(Boolean).join(' at ') || 'No target set'}
                        </span>
                      </span>
                      {r.outdatedCount > 0 ? <Badge tone="warn">{r.outdatedCount} changed</Badge> : null}
                      <span className="text-muted hidden text-xs sm:block">{formatDateTime(r.updatedAt)}</span>
                      <ArrowRight className="text-muted size-4" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <aside>
          {remaining.length > 0 ? (
            <Card className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="text-brand size-4" aria-hidden />
                <h2 className="text-ink text-base font-semibold tracking-tight">Set up your library</h2>
              </div>
              <p className="text-muted mb-4 text-sm">
                {steps.length - remaining.length} of {steps.length} steps done. Everything you enter is reused by every resume.
              </p>
              <ProgressBar value={steps.length - remaining.length} max={steps.length} label="Setup progress" />
              <ol className="mt-4 space-y-1">
                {steps.map((s) => (
                  <li key={s.id}>
                    {s.done ? (
                      <span className="text-muted flex items-center gap-2.5 py-1.5 text-sm">
                        <Check className="text-ok size-4" aria-label="Done" />
                        <span className="line-through">{s.label}</span>
                      </span>
                    ) : (
                      <Link
                        href={s.href}
                        className="hover:bg-sunken text-ink flex items-center gap-2.5 rounded-lg px-1 py-1.5 text-sm font-medium"
                      >
                        <span className="border-line-strong size-4 shrink-0 rounded-full border-2" aria-label="Not done" />
                        {s.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
              <p className="text-muted border-line mt-4 border-t pt-4 text-sm">
                Already have a backup file? Restore it in{' '}
                <Link href="/settings" className="link">
                  Settings &amp; backup
                </Link>
                .
              </p>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="text-ink mb-3 text-base font-semibold tracking-tight">Quick actions</h2>
              <div className="flex flex-col gap-2">
                <Link href="/resumes" className={buttonClass('primary')}>
                  Create a tailored resume
                </Link>
                <Link href="/projects/new" className={buttonClass('secondary')}>
                  Add a project
                </Link>
                <Link href="/settings" className={buttonClass('secondary')}>
                  Download a backup
                </Link>
              </div>
            </Card>
          )}
        </aside>
      </div>
    </>
  );
}
