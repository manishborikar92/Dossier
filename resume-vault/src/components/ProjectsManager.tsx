'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Upload } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import type { Project } from '@/lib/types';
import { Badge, Button, Dialog, EmptyState, SelectField, TextField, buttonClass, useToast } from './ui';

interface ImportResult {
  imported: number;
  skipped: string[];
  belowMinScore: number;
  failed: { id: string; reason: string }[];
}

export function ProjectsManager({ initial }: { initial: Project[] }) {
  const toast = useToast();
  const [projects, setProjects] = useState<Project[]>(initial);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | 'all'>('active');
  const [tech, setTech] = useState('');
  const [sort, setSort] = useState<'library' | 'name'>('library');
  const [importing, setImporting] = useState(false);

  const reload = async () => setProjects(await api<Project[]>('/api/library/projects'));

  const technologies = useMemo(() => [...new Set(projects.flatMap((p) => p.technologies))].sort((a, b) => a.localeCompare(b)), [projects]);
  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = projects.filter((p) => {
      if (status !== 'all' && p.status !== status) return false;
      if (tech && !p.technologies.includes(tech)) return false;
      if (!needle) return true;
      return [p.name, p.overview, p.family, p.category, ...p.technologies, ...p.tags, ...p.keywords].join(' ').toLowerCase().includes(needle);
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
      await api('/api/library/projects/reorder', { body: { ids } });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <TextField label="Search" value={q} onChange={setQ} placeholder="Name, technology, tag" className="min-w-[14rem] flex-1" />
        <SelectField label="Show" value={status} onChange={(v) => setStatus(v as typeof status)} options={[{ value: 'active', label: 'Active' }, { value: 'archived', label: 'Archived' }, { value: 'all', label: 'All' }]} />
        <SelectField label="Technology" value={tech} onChange={setTech} options={[{ value: '', label: 'Any' }, ...technologies.map((t) => ({ value: t, label: t }))]} />
        <SelectField label="Order" value={sort} onChange={(v) => setSort(v as typeof sort)} options={[{ value: 'library', label: 'My order' }, { value: 'name', label: 'Name' }]} />
      </div>
      <p className="mb-3 text-sm text-muted">
        {visible.length} of {projects.length} {projects.length === 1 ? 'project' : 'projects'}. New resumes start with the first three active projects in your order, so put your strongest ones first.
      </p>

      {projects.length === 0 ? (
        <EmptyState
          title="Your project library is empty"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Link href="/projects/new" className={buttonClass('primary')}>Add a project</Link>
              <Button onClick={() => setImporting(true)}>Import knowledge base</Button>
            </div>
          }
        >
          Add projects once and reuse them in as many resumes as you like. If you have a project_knowledge_base.json file, you can import it.
        </EmptyState>
      ) : visible.length === 0 ? (
        <EmptyState title="No projects match">Try a different search or filter.</EmptyState>
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
          {visible.map((p) => {
            const unverified = p.bullets.filter((b) => !b.verified).length;
            return (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/projects/${p.id}`} className="font-medium text-navy underline underline-offset-2">
                    {p.name}
                  </Link>
                  {p.overview ? <p className="mt-0.5 line-clamp-2 text-sm text-muted">{p.overview}</p> : null}
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {p.yearLabel ? <Badge>{p.yearLabel}</Badge> : null}
                    {p.status === 'archived' ? <Badge tone="warn">Archived</Badge> : null}
                    {p.family ? <Badge title="Family">{p.family}</Badge> : null}
                    <Badge>{p.bullets.length} {p.bullets.length === 1 ? 'bullet' : 'bullets'}</Badge>
                    {unverified > 0 ? <Badge tone="warn">{unverified} unverified</Badge> : null}
                    {p.usedInCount > 0 ? <Badge>Used in {p.usedInCount}</Badge> : null}
                    <span className="text-xs text-muted">{p.technologies.slice(0, 6).join(' \u00b7 ')}{p.technologies.length > 6 ? ' \u00b7 \u2026' : ''}</span>
                  </div>
                </div>
                {canReorder ? (
                  <div className="flex shrink-0 gap-0.5">
                    <button type="button" aria-label={`Move ${p.name} up`} disabled={visible[0].id === p.id} onClick={() => move(p, -1)} className="rounded p-1.5 text-muted hover:bg-navy-soft disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" aria-hidden />
                    </button>
                    <button type="button" aria-label={`Move ${p.name} down`} disabled={visible[visible.length - 1].id === p.id} onClick={() => move(p, 1)} className="rounded p-1.5 text-muted hover:bg-navy-soft disabled:opacity-30">
                      <ArrowDown className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ImportDialog open={importing} onClose={() => setImporting(false)} onDone={reload} />
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href="/projects/new" className={buttonClass('primary')}>
          <Plus className="h-4 w-4" aria-hidden />
          Add project
        </Link>
        <Button onClick={() => setImporting(true)}>
          <Upload className="h-4 w-4" aria-hidden />
          Import knowledge base
        </Button>
      </div>
    </div>
  );
}

function ImportDialog({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => Promise<void> }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<unknown[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [minScore, setMinScore] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const reset = () => {
    setData(null);
    setFileName('');
    setMinScore('');
    setError('');
    setResult(null);
  };
  const close = () => {
    reset();
    onClose();
  };

  async function onFile(file: File | undefined) {
    setResult(null);
    setError('');
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('This file is not a list of projects.');
      setData(parsed);
      setFileName(file.name);
    } catch (e) {
      setData(null);
      setError(e instanceof SyntaxError ? 'This file is not valid JSON.' : errorMessage(e));
    }
  }

  async function run() {
    if (!data) return;
    const score = minScore.trim() === '' ? undefined : Number(minScore);
    if (score !== undefined && (Number.isNaN(score) || score < 0 || score > 100)) {
      setError('The minimum score must be a number from 0 to 100, or empty.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api<ImportResult>('/api/import/knowledge-base', { body: { data, minScore: score } });
      setResult(res);
      await onDone();
      toast.success(`Imported ${res.imported} ${res.imported === 1 ? 'project' : 'projects'}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Import a project knowledge base"
      footer={
        result ? (
          <Button variant="primary" onClick={close}>Done</Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!data} onClick={run}>
              Import projects
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-sm">
        <p>
          Choose a <code>project_knowledge_base.json</code> file. Projects are added to your library with their bullets marked <strong>unverified</strong>. Role, contributions, results and repository links are left empty because the file does not state them. Projects already in your library are skipped, so importing twice is safe.
        </p>
        <div>
          <label htmlFor="kb-file" className="mb-1 block font-medium">JSON file</label>
          <input id="kb-file" ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => onFile(e.target.files?.[0])} className="block w-full text-sm" />
          {data ? <p className="mt-1 text-muted">{fileName}: {data.length} projects found.</p> : null}
        </div>
        <TextField label="Skip projects scored below (optional)" value={minScore} onChange={setMinScore} hint="Leave empty to import everything. You can archive projects later." className="max-w-xs" />
        {error ? <p role="alert" className="font-medium text-bad">{error}</p> : null}
        {result ? (
          <div role="status" className="rounded-md bg-ok-bg p-3 text-ok">
            <p className="font-medium">Imported {result.imported}.</p>
            {result.skipped.length > 0 ? <p>{result.skipped.length} already in your library and left as they are.</p> : null}
            {result.belowMinScore > 0 ? <p>{result.belowMinScore} below the minimum score.</p> : null}
            {result.failed.length > 0 ? <p className="text-bad">{result.failed.length} could not be read: {result.failed.map((f) => f.id).join(', ')}.</p> : null}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
