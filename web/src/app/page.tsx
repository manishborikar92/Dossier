import { AlertTriangle, ArrowRight, Briefcase, Check, CheckCircle2, FileText, FolderGit2, Plus, Sparkles, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Badge, Card, ProgressBar, SectionCard, PageHeader, buttonClass } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { getDb } from '@/server/db';
import { getDashboardData } from '@/server/stats';

export default function DashboardPage() {
  const { profile, counts, unverifiedBullets, resumes, needsReview, steps } = getDashboardData(getDb());
  const remaining = steps.filter((s) => !s.done);
  const firstName = profile.fullName ? profile.fullName.split(' ')[0] : '';

  const tiles = [
    { label: 'Projects', value: counts.projects, href: '/projects', icon: FolderGit2, detail: 'In library' },
    { label: 'Experience entries', value: counts.experiences, href: '/career', icon: Briefcase, detail: 'Roles & jobs' },
    { label: 'Skills recorded', value: counts.skills, href: '/career?tab=skills', icon: Wrench, detail: 'Technologies' },
    { label: 'Tailored resumes', value: counts.resumes, href: '/resumes', icon: FileText, detail: 'Ready to export' },
  ];

  const totalOutdatedCount = needsReview.reduce((sum, r) => sum + r.outdatedCount, 0);
  const totalAttentionItems = totalOutdatedCount + unverifiedBullets;

  return (
    <>
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : 'Welcome to Dossier'}
        description="Keep your career facts in one local dossier and build independent, tailored resumes from it."
        actions={
          <>
            <Link href="/projects/new" className={buttonClass('secondary')}>
              <Plus className="size-4" aria-hidden />
              Add project
            </Link>
            <Link href="/resumes" className={buttonClass('primary')}>
              <FileText className="size-4" aria-hidden />
              {resumes.length === 0 ? 'Create resume' : 'Open resumes'}
            </Link>
          </>
        }
      />

      {/* Metrics Row */}
      <ul className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {tiles.map(({ label, value, href, icon: Icon, detail }) => (
          <li key={label}>
            <Link
              href={href}
              className="group border-line bg-surface shadow-card hover:border-brand-line hover:bg-sunken flex flex-col justify-between rounded-xl border p-4 sm:p-5 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="bg-brand-soft text-brand flex size-9.5 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-muted/70 text-xs font-medium">{detail}</span>
              </div>
              <div className="mt-3">
                <span className="text-ink block text-2xl sm:text-3xl leading-none font-bold tracking-tight tabular-nums">{value}</span>
                <span className="text-muted group-hover:text-ink mt-1.5 block text-xs sm:text-[13px] font-medium transition-colors">
                  {label}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          {/* Needs Review / Needs Attention Section */}
          <SectionCard
            title="Needs your attention"
            description="Changes in your library or unconfirmed points to inspect before sending a resume."
            action={
              totalAttentionItems > 0 ? (
                <Badge tone="warn">
                  {totalAttentionItems} {totalAttentionItems === 1 ? 'item' : 'items'} to check
                </Badge>
              ) : (
                <Badge tone="ok">All verified</Badge>
              )
            }
          >
            {needsReview.length === 0 && unverifiedBullets === 0 ? (
              <div className="border-line bg-ok-soft/30 flex items-center gap-3 rounded-lg border p-4 text-sm">
                <CheckCircle2 className="text-ok size-5 shrink-0" aria-hidden />
                <div>
                  <p className="text-ink font-medium">All clear</p>
                  <p className="text-muted text-xs mt-0.5">Your resumes match your library and every bullet is verified.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {needsReview.map((r) => (
                  <div
                    key={r.id}
                    className="border-warn/25 bg-warn-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <AlertTriangle className="text-warn mt-0.5 size-4.5 shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-semibold truncate">{r.name}</p>
                        <p className="text-muted text-xs mt-0.5">
                          Has{' '}
                          <strong className="text-warn font-semibold">
                            {r.outdatedCount} {r.outdatedCount === 1 ? 'item' : 'items'}
                          </strong>{' '}
                          where your library has changed since this resume was created.
                        </p>
                      </div>
                    </div>
                    <Link href={`/resumes/${r.id}?review=1`} className={buttonClass('secondary', 'sm')}>
                      Review changes
                    </Link>
                  </div>
                ))}

                {unverifiedBullets > 0 ? (
                  <div className="border-warn/25 bg-warn-soft/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition-colors">
                    <div className="flex items-start gap-3 min-w-0">
                      <AlertTriangle className="text-warn mt-0.5 size-4.5 shrink-0" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-semibold">
                          {unverifiedBullets} unverified {unverifiedBullets === 1 ? 'bullet' : 'bullets'} in library
                        </p>
                        <p className="text-muted text-xs mt-0.5">
                          Imported or unconfirmed bullets should be checked against what you actually accomplished before exporting.
                        </p>
                      </div>
                    </div>
                    <Link href="/projects?unverified=true" className={buttonClass('secondary', 'sm')}>
                      Filter projects
                    </Link>
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>

          {/* Recent Resumes Card */}
          <SectionCard
            title="Recent resumes"
            description="Open and continue editing your saved resumes."
            action={
              resumes.length > 0 ? (
                <Link href="/resumes" className="link text-sm font-medium">
                  View all ({resumes.length})
                </Link>
              ) : undefined
            }
            bodyClassName="p-0"
          >
            {resumes.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-muted text-sm">No resumes yet. Once your library has some content, create your first tailored resume.</p>
                <div className="mt-4">
                  <Link href="/resumes" className={buttonClass('primary', 'sm')}>
                    Create resume
                  </Link>
                </div>
              </div>
            ) : (
              <ul className="divide-line divide-y">
                {resumes.slice(0, 5).map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/resumes/${r.id}`}
                      className="hover:bg-sunken flex items-center justify-between gap-3 px-5 py-3.5 transition-colors"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="bg-brand-soft text-brand flex size-9 shrink-0 items-center justify-center rounded-lg">
                          <FileText className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <span className="text-ink block truncate text-sm font-semibold">{r.name}</span>
                          <span className="text-muted block truncate text-xs">
                            {[r.targetTitle, r.targetCompany].filter(Boolean).join(' at ') || 'No target set'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {r.outdatedCount > 0 ? <Badge tone="warn">{r.outdatedCount} changed</Badge> : null}
                        <Badge tone={r.status === 'final' ? 'ok' : 'neutral'}>{r.status === 'final' ? 'Final' : 'Draft'}</Badge>
                        <span className="text-muted hidden text-xs md:inline tabular-nums" suppressHydrationWarning>
                          {formatDateTime(r.updatedAt)}
                        </span>
                        <ArrowRight className="text-muted/60 size-4" aria-hidden />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Sidebar aside (Setup steps or Quick actions) */}
        <aside className="space-y-6">
          {remaining.length > 0 ? (
            <Card className="p-5">
              <div className="mb-1 flex items-center gap-2">
                <Sparkles className="text-brand size-4" aria-hidden />
                <h2 className="text-ink text-base font-semibold tracking-tight">Set up your library</h2>
              </div>
              <p className="text-muted mb-4 text-xs sm:text-sm">
                {steps.length - remaining.length} of {steps.length} steps completed.
              </p>
              <ProgressBar value={steps.length - remaining.length} max={steps.length} label="Setup progress" />
              <ol className="mt-4 space-y-1">
                {steps.map((s) => (
                  <li key={s.id}>
                    {s.done ? (
                      <span className="text-muted/80 flex items-center gap-2.5 py-1.5 text-xs sm:text-sm">
                        <Check className="text-ok size-4 shrink-0" aria-label="Done" />
                        <span className="line-through">{s.label}</span>
                      </span>
                    ) : (
                      <Link
                        href={s.href}
                        className="hover:bg-sunken text-ink flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-xs sm:text-sm font-medium transition-colors"
                      >
                        <span className="border-line-strong size-4 shrink-0 rounded-full border-2" aria-label="Not done" />
                        {s.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ol>
              <p className="text-muted border-line mt-4 border-t pt-4 text-xs sm:text-sm">
                Already have a backup file? Restore it in{' '}
                <Link href="/settings" className="link font-medium">
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
                  <FileText className="size-4" aria-hidden />
                  Create a tailored resume
                </Link>
                <Link href="/projects/new" className={buttonClass('secondary')}>
                  <Plus className="size-4" aria-hidden />
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
