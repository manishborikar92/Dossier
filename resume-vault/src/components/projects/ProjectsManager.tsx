'use client';

import { ArrowDown, ArrowUp, CheckCircle2, FolderGit2, Plus, Search, ShieldAlert, Upload } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { buttonClass } from '@/lib/classes';
import type { Project } from '@/lib/types';
import { Badge, Button, Card, EmptyState, IconButton, PageHeader, SelectField, useToast } from '../ui';
import { ImportDialog } from './ImportDialog';

const PAGE_SIZE = 20;

type StatusFilter = 'active' | 'archived' | 'all';
type SortOrder = 'library' | 'name';
type VerifyFilter = 'all' | 'unverified';

function ProjectsManagerContent({ initial }: { initial: Project[] }) {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>(initial);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [tech, setTech] = useState('');
  const [sort, setSort] = useState<SortOrder>('library');
  const [verifyFilter, setVerifyFilter] = useState<VerifyFilter>(() =>
    searchParams?.get('unverified') === 'true' ? 'unverified' : 'all',
  );
  const [importing, setImporting] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const reload = async () => setProjects(await api.library.list('projects'));

  const technologies = useMemo(
    () => [...new Set(projects.flatMap((p) => p.technologies))].sort((a, b) => a.localeCompare(b)),
    [projects],
  );

  const totalUnverifiedProjects = useMemo(
    () => projects.filter((p) => p.bullets.some((b) => !b.verified)).length,
    [projects],
  );

  const totalUnverifiedBullets = useMemo(
    () => projects.reduce((acc, p) => acc + p.bullets.filter((b) => !b.verified).length, 0),
    [projects],
  );

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (tech && !p.technologies.includes(tech)) return false;
      if (verifyFilter === 'unverified' && p.bullets.every((b) => b.verified)) return false;
      if (!needle) return true;
      return [p.name, p.overview, p.family, p.category, ...p.technologies, ...p.tags, ...p.keywords]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    return sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [projects, q, status, tech, sort, verifyFilter]);

  const canReorder = sort === 'library' && q.trim() === '' && tech === '' && status !== 'all' && verifyFilter === 'all';

  async function move(project: Project, dir: -1 | 1) {
    const vi = visible.findIndex((p) => p.id === project.id);
    const other = visible[vi + dir];
    if (!other) return;
    const ids = projects.map((p) => p.id);
    const a = ids.indexOf(project.id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    try {
      await api.library.reorder('projects', ids);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  const addButtons = (
    <div className="flex items-center gap-2">
      <Button onClick={() => setImporting(true)}>
        <Upload className="size-4" aria-hidden />
        <span className="hidden sm:inline">Import knowledge base</span>
        <span className="sm:hidden">Import</span>
      </Button>
      <Link href="/projects/new" className={buttonClass('primary')}>
        <Plus className="size-4" aria-hidden />
        Add project
      </Link>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Your project library. Add each project once, then choose which ones appear on each resume."
        actions={addButtons}
      />

      {/* Alert banner if there are unverified bullets */}
      {totalUnverifiedBullets > 0 ? (
        <div className="border-line bg-warn-soft/30 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4">
          <div className="flex items-start gap-3 min-w-0">
            <ShieldAlert className="text-warn mt-0.5 size-5 shrink-0" aria-hidden />
            <div>
              <p className="text-ink text-sm font-semibold">
                {totalUnverifiedBullets} unverified {totalUnverifiedBullets === 1 ? 'bullet' : 'bullets'} across {totalUnverifiedProjects} {totalUnverifiedProjects === 1 ? 'project' : 'projects'}
              </p>
              <p className="text-muted text-xs mt-0.5">
                Imported items start unverified. Review and check them off to verify accuracy before exporting resumes.
              </p>
            </div>
          </div>
          {verifyFilter !== 'unverified' ? (
            <Button
              size="sm"
              onClick={() => setVerifyFilter('unverified')}
              className="shrink-0"
            >
              Filter unverified ({totalUnverifiedProjects})
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setVerifyFilter('all')}
              className="shrink-0"
            >
              Show all projects
            </Button>
          )}
        </div>
      ) : null}

      {projects.length === 0 ? (
        <EmptyState icon={FolderGit2} title="Your project library is empty" action={addButtons}>
          Add projects once and reuse them in as many resumes as you like. If you have a project_knowledge_base.json file, you can import it.
        </EmptyState>
      ) : (
        <>
          {/* Cloudflare-style Filter Bar */}
          <Card className="mb-4 p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr] items-end">
              <div className="min-w-0">
                <label htmlFor="project-search" className="text-ink-2 mb-1.5 block text-xs font-medium">
                  Search projects
                </label>
                <div className="relative">
                  <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
                  <input
                    id="project-search"
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Name, technology, tag..."
                    className="border-line-strong bg-surface placeholder:text-muted/70 focus:border-brand focus:ring-brand/15 shadow-xs block w-full rounded-lg border py-2 pr-3 pl-9 text-sm focus:ring-[3px] focus:outline-none"
                  />
                </div>
              </div>

              <SelectField
                label="Status"
                value={status}
                onChange={(v) => setStatus(v as StatusFilter)}
                options={[
                  { value: 'active', label: 'Active only' },
                  { value: 'archived', label: 'Archived only' },
                  { value: 'all', label: 'All statuses' },
                ]}
              />

              <SelectField
                label="Technology"
                value={tech}
                onChange={setTech}
                options={[{ value: '', label: 'All technologies' }, ...technologies.map((t) => ({ value: t, label: t }))]}
              />

              <SelectField
                label="Verification"
                value={verifyFilter}
                onChange={(v) => setVerifyFilter(v as VerifyFilter)}
                options={[
                  { value: 'all', label: 'All projects' },
                  { value: 'unverified', label: `Needs verification (${totalUnverifiedProjects})` },
                ]}
              />

              <SelectField
                label="Sort order"
                value={sort}
                onChange={(v) => setSort(v as SortOrder)}
                options={[
                  { value: 'library', label: 'Library order' },
                  { value: 'name', label: 'Alphabetical' },
                ]}
              />
            </div>
          </Card>

          {/* Result summary */}
          <div className="mb-3 flex items-center justify-between text-xs text-muted">
            <p>
              Showing {visible.length} of {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              {verifyFilter === 'unverified' ? ' (filtered to unverified)' : ''}
            </p>
            {canReorder ? (
              <span className="hidden sm:inline">Use up/down arrows to adjust ordering on resumes</span>
            ) : null}
          </div>

          {visible.length === 0 ? (
            <EmptyState icon={Search} title="No projects match">
              Try adjusting your search terms or filters.
              {verifyFilter === 'unverified' ? (
                <div className="mt-3">
                  <Button size="sm" onClick={() => setVerifyFilter('all')}>
                    Clear unverified filter
                  </Button>
                </div>
              ) : null}
            </EmptyState>
          ) : (
            <ul className="divide-line border-line bg-surface shadow-card divide-y rounded-xl border">
              {visible.slice(0, limit).map((p) => {
                const unverified = p.bullets.filter((b) => !b.verified).length;
                return (
                  <li key={p.id} className="group hover:bg-sunken/40 flex items-start gap-4 px-5 py-4 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-ink group-hover:text-brand dark:group-hover:text-blue-400 font-semibold tracking-tight text-base hover:underline transition-colors"
                        >
                          {p.name}
                        </Link>
                        {p.yearLabel ? <Badge tone="brand">{p.yearLabel}</Badge> : null}
                        {p.status === 'archived' ? <Badge tone="warn">Archived</Badge> : null}
                      </div>

                      {p.overview ? (
                        <p className="text-muted mt-1 line-clamp-2 text-sm leading-relaxed">{p.overview}</p>
                      ) : null}

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {p.family ? <Badge title="Project family">{p.family}</Badge> : null}
                        <Badge>
                          {p.bullets.length} {p.bullets.length === 1 ? 'bullet' : 'bullets'}
                        </Badge>
                        {unverified > 0 ? (
                          <Badge tone="warn" title={`${unverified} bullets need verification`}>
                            {unverified} unverified
                          </Badge>
                        ) : (
                          <Badge tone="ok" title="All bullets verified">
                            <CheckCircle2 className="size-3" aria-hidden />
                            Verified
                          </Badge>
                        )}
                        {p.usedInCount > 0 ? <Badge>Used in {p.usedInCount}</Badge> : null}
                      </div>

                      {p.technologies.length > 0 ? (
                        <p className="text-muted mt-2 text-xs leading-normal">
                          {p.technologies.slice(0, 8).join(' \u00b7 ')}
                          {p.technologies.length > 8 ? ` \u00b7 +${p.technologies.length - 8} more` : ''}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1 pt-1">
                      {canReorder ? (
                        <div className="flex">
                          <IconButton
                            label={`Move ${p.name} up`}
                            icon={ArrowUp}
                            disabled={visible[0].id === p.id}
                            onClick={() => move(p, -1)}
                          />
                          <IconButton
                            label={`Move ${p.name} down`}
                            icon={ArrowDown}
                            disabled={visible[visible.length - 1].id === p.id}
                            onClick={() => move(p, 1)}
                          />
                        </div>
                      ) : null}
                      <Link
                        href={`/projects/${p.id}`}
                        className={buttonClass('secondary', 'sm')}
                      >
                        Edit
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {visible.length > limit ? (
            <div className="mt-5 text-center">
              <Button onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Show {Math.min(PAGE_SIZE, visible.length - limit)} more projects
              </Button>
            </div>
          ) : null}
        </>
      )}

      <ImportDialog open={importing} onClose={() => setImporting(false)} onDone={reload} />
    </div>
  );
}

export function ProjectsManager({ initial }: { initial: Project[] }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading projects...</div>}>
      <ProjectsManagerContent initial={initial} />
    </Suspense>
  );
}
