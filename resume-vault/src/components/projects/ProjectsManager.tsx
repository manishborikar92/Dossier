'use client';

import { ArrowDown, ArrowUp, FolderGit2, Plus, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { buttonClass } from '@/lib/classes';
import type { Project } from '@/lib/types';
import { Badge, Button, Card, EmptyState, IconButton, SelectField, useToast } from '../ui';
import { ImportDialog } from './ImportDialog';

const PAGE_SIZE = 20;

type StatusFilter = 'active' | 'archived' | 'all';
type SortOrder = 'library' | 'name';

export function ProjectsManager({ initial }: { initial: Project[] }) {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>(initial);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('active');
  const [tech, setTech] = useState('');
  const [sort, setSort] = useState<SortOrder>('library');
  const [importing, setImporting] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const reload = async () => setProjects(await api.library.list('projects'));

  const technologies = useMemo(() => [...new Set(projects.flatMap((p) => p.technologies))].sort((a, b) => a.localeCompare(b)), [projects]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (tech && !p.technologies.includes(tech)) return false;
      if (!needle) return true;
      return [p.name, p.overview, p.family, p.category, ...p.technologies, ...p.tags, ...p.keywords]
        .join(' ')
        .toLowerCase()
        .includes(needle);
    });
    return sort === 'name' ? [...list].sort((a, b) => a.name.localeCompare(b.name)) : list;
  }, [projects, q, status, tech, sort]);

  const canReorder = sort === 'library' && q.trim() === '' && tech === '' && status !== 'all';

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
    <>
      <Button onClick={() => setImporting(true)}>
        <Upload className="size-4" aria-hidden />
        Import knowledge base
      </Button>
      <Link href="/projects/new" className={buttonClass('primary')}>
        <Plus className="size-4" aria-hidden />
        Add project
      </Link>
    </>
  );

  return (
    <div>
      {projects.length === 0 ? (
        <EmptyState icon={FolderGit2} title="Your project library is empty" action={addButtons}>
          Add projects once and reuse them in as many resumes as you like. If you have a project_knowledge_base.json file, you can import
          it.
        </EmptyState>
      ) : (
        <>
          <Card className="mb-4 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-56 flex-1">
                <label htmlFor="project-search" className="text-ink-2 mb-1.5 block text-[13px] font-medium">
                  Search
                </label>
                <div className="relative">
                  <Search className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
                  <input
                    id="project-search"
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Name, technology, tag"
                    className="border-line-strong bg-surface placeholder:text-muted/70 focus:border-brand focus:ring-brand/15 shadow-xs block w-full rounded-lg border py-2 pr-3 pl-9 text-sm focus:ring-[3px] focus:outline-none"
                  />
                </div>
              </div>
              <SelectField
                label="Show"
                value={status}
                onChange={(v) => setStatus(v as StatusFilter)}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'archived', label: 'Archived' },
                  { value: 'all', label: 'All' },
                ]}
              />
              <SelectField
                label="Technology"
                value={tech}
                onChange={setTech}
                options={[{ value: '', label: 'Any' }, ...technologies.map((t) => ({ value: t, label: t }))]}
              />
              <SelectField
                label="Order"
                value={sort}
                onChange={(v) => setSort(v as SortOrder)}
                options={[
                  { value: 'library', label: 'My order' },
                  { value: 'name', label: 'Name' },
                ]}
              />
              <div className="ml-auto flex gap-2">{addButtons}</div>
            </div>
          </Card>

          <p className="text-muted mb-3 text-sm">
            Showing {visible.length} of {projects.length} {projects.length === 1 ? 'project' : 'projects'}. New resumes start with the first
            three active projects in your order, so put your strongest ones first.
          </p>

          {visible.length === 0 ? (
            <EmptyState icon={Search} title="No projects match">
              Try a different search or filter.
            </EmptyState>
          ) : (
            <ul className="divide-line border-line bg-surface shadow-card divide-y rounded-xl border">
              {visible.slice(0, limit).map((p) => {
                const unverified = p.bullets.filter((b) => !b.verified).length;
                return (
                  <li key={p.id} className="flex items-start gap-3 px-5 py-4">
                    <div className="min-w-0 flex-1">
                      <Link href={`/projects/${p.id}`} className="text-brand font-medium hover:underline">
                        {p.name}
                      </Link>
                      {p.overview ? <p className="text-muted mt-0.5 line-clamp-2 text-sm">{p.overview}</p> : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {p.yearLabel ? <Badge tone="brand">{p.yearLabel}</Badge> : null}
                        {p.status === 'archived' ? <Badge tone="warn">Archived</Badge> : null}
                        {p.family ? <Badge title="Family">{p.family}</Badge> : null}
                        <Badge>
                          {p.bullets.length} {p.bullets.length === 1 ? 'bullet' : 'bullets'}
                        </Badge>
                        {unverified > 0 ? <Badge tone="warn">{unverified} unverified</Badge> : null}
                        {p.usedInCount > 0 ? <Badge>Used in {p.usedInCount}</Badge> : null}
                      </div>
                      {p.technologies.length > 0 ? (
                        <p className="text-muted mt-2 text-xs">
                          {p.technologies.slice(0, 7).join(' \u00b7 ')}
                          {p.technologies.length > 7 ? ` \u00b7 +${p.technologies.length - 7} more` : ''}
                        </p>
                      ) : null}
                    </div>
                    {canReorder ? (
                      <div className="flex shrink-0">
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
                  </li>
                );
              })}
            </ul>
          )}
          {visible.length > limit ? (
            <div className="mt-4 text-center">
              <Button onClick={() => setLimit((n) => n + PAGE_SIZE)}>Show {Math.min(PAGE_SIZE, visible.length - limit)} more</Button>
            </div>
          ) : null}
        </>
      )}
      <ImportDialog open={importing} onClose={() => setImporting(false)} onDone={reload} />
    </div>
  );
}
