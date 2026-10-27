'use client';

import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ApiError, api, errorMessage } from '@/lib/api';
import { issuesToFields, projectSchema } from '@/lib/schemas';
import type { Project } from '@/lib/types';
import { BulletList, type EditableBullet } from '../shared/BulletList';
import { Badge, Button, ConfirmDialog, Notice, SectionCard, SelectField, TagInput, TextArea, TextField, useToast } from '../ui';

interface Draft {
  name: string;
  category: string;
  overview: string;
  description: string;
  problem: string;
  solution: string;
  role: string;
  contributions: string;
  technologies: string[];
  features: string;
  decisions: string;
  results: string;
  repoUrl: string;
  demoUrl: string;
  docsUrl: string;
  tags: string[];
  keywords: string[];
  yearLabel: string;
  family: string;
  status: 'active' | 'archived';
  notes: string;
  bullets: EditableBullet[];
}

const BLANK: Draft = {
  name: '',
  category: '',
  overview: '',
  description: '',
  problem: '',
  solution: '',
  role: '',
  contributions: '',
  technologies: [],
  features: '',
  decisions: '',
  results: '',
  repoUrl: '',
  demoUrl: '',
  docsUrl: '',
  tags: [],
  keywords: [],
  yearLabel: '',
  family: '',
  status: 'active',
  notes: '',
  bullets: [],
};

const toDraft = (p: Project): Draft => ({ ...p, bullets: p.bullets.map((b) => ({ id: b.id, text: b.text, verified: b.verified })) });

const SECTIONS = [
  { id: 'basics', label: 'The basics' },
  { id: 'about', label: 'What it is' },
  { id: 'role', label: 'Your part in it' },
  { id: 'technology', label: 'Technology' },
  { id: 'results', label: 'Results' },
  { id: 'links', label: 'Links' },
  { id: 'tags', label: 'Tags and keywords' },
  { id: 'bullets', label: 'Resume bullets' },
  { id: 'notes', label: 'Private notes' },
] as const;

export function ProjectForm({ initial }: { initial: Project | null }) {
  const router = useRouter();
  const toast = useToast();
  const [baseline, setBaseline] = useState<Draft>(() => (initial ? toDraft(initial) : BLANK));
  const [draft, setDraft] = useState<Draft>(() => (initial ? toDraft(initial) : BLANK));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const archived = draft.status === 'archived';
  const unverified = draft.bullets.filter((b) => !b.verified).length;

  async function persist(next: Draft, message: string) {
    const parsed = projectSchema.safeParse(next);
    if (!parsed.success) {
      setErrors(issuesToFields(parsed.error.issues));
      toast.error('Some fields need attention. They are marked below.');
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      if (initial) {
        const saved = await api.library.update('projects', initial.id, parsed.data);
        const fresh = toDraft(saved);
        setDraft(fresh);
        setBaseline(fresh);
        toast.success(message);
        router.refresh();
      } else {
        const created = await api.library.create('projects', parsed.data);
        toast.success('Project added.');
        router.push(`/projects/${created.id}`);
      }
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fields).length > 0) setErrors(error.fields);
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    setDeleting(true);
    try {
      await api.library.remove('projects', initial.id);
      toast.success('Project deleted.');
      router.push('/projects');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
    }
  }

  const saveLabel = initial ? 'Save changes' : 'Add project';

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <div className="space-y-6">
        <SectionCard id="basics" title="The basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Project name"
              required
              value={draft.name}
              onChange={(v) => set({ name: v })}
              error={errors.name}
              className="sm:col-span-2"
              hint="As it should read on a resume, e.g. CA-Workflow – Workflow Management Platform"
            />
            <TextField
              label="Category"
              value={draft.category}
              onChange={(v) => set({ category: v })}
              error={errors.category}
              hint="e.g. Web app, Desktop tool, Machine learning"
            />
            <TextField
              label="Year or period"
              value={draft.yearLabel}
              onChange={(v) => set({ yearLabel: v })}
              error={errors.yearLabel}
              hint="Printed on the resume, e.g. 2025 or 2024 – 2025"
            />
            <TextField
              label="Family"
              value={draft.family}
              onChange={(v) => set({ family: v })}
              error={errors.family}
              hint="Use the same name for repositories that make up one product."
              className="sm:col-span-2"
            />
          </div>
        </SectionCard>

        <SectionCard id="about" title="What it is" description="Plain facts. These feed suggestions and help you write bullets later.">
          <div className="space-y-4">
            <TextArea
              label="Overview"
              rows={2}
              value={draft.overview}
              onChange={(v) => set({ overview: v })}
              error={errors.overview}
              hint="One or two sentences: what it is and who it is for."
            />
            <TextArea
              label="Detailed description"
              rows={4}
              value={draft.description}
              onChange={(v) => set({ description: v })}
              error={errors.description}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextArea
                label="Problem it addresses"
                rows={3}
                value={draft.problem}
                onChange={(v) => set({ problem: v })}
                error={errors.problem}
              />
              <TextArea
                label="Solution you implemented"
                rows={3}
                value={draft.solution}
                onChange={(v) => set({ solution: v })}
                error={errors.solution}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="role"
          title="Your part in it"
          description="Be exact. Say whether you worked alone or in a team, because an interviewer will ask."
        >
          <div className="space-y-4">
            <TextArea label="Your role" rows={2} value={draft.role} onChange={(v) => set({ role: v })} error={errors.role} />
            <TextArea
              label="What you personally built or decided"
              rows={3}
              value={draft.contributions}
              onChange={(v) => set({ contributions: v })}
              error={errors.contributions}
            />
          </div>
        </SectionCard>

        <SectionCard id="technology" title="Technology">
          <div className="space-y-4">
            <TagInput
              label="Technologies and tools"
              value={draft.technologies}
              onChange={(v) => set({ technologies: v })}
              hint="Press Enter or type a comma after each one. These are matched against job descriptions."
              placeholder="e.g. Next.js"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextArea
                label="Important features"
                rows={3}
                value={draft.features}
                onChange={(v) => set({ features: v })}
                error={errors.features}
              />
              <TextArea
                label="Technical decisions"
                rows={3}
                value={draft.decisions}
                onChange={(v) => set({ decisions: v })}
                error={errors.decisions}
                hint="What you chose and why."
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          id="results"
          title="Results"
          description="Only results you can verify, such as users, uptime or time saved. Leave this empty if you do not know."
        >
          <TextArea label="Verified results" rows={3} value={draft.results} onChange={(v) => set({ results: v })} error={errors.results} />
        </SectionCard>

        <SectionCard id="links" title="Links">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField
              label="Repository"
              value={draft.repoUrl}
              onChange={(v) => set({ repoUrl: v })}
              error={errors.repoUrl}
              placeholder="https://"
            />
            <TextField
              label="Live demo"
              value={draft.demoUrl}
              onChange={(v) => set({ demoUrl: v })}
              error={errors.demoUrl}
              placeholder="https://"
            />
            <TextField
              label="Documentation"
              value={draft.docsUrl}
              onChange={(v) => set({ docsUrl: v })}
              error={errors.docsUrl}
              placeholder="https://"
            />
          </div>
        </SectionCard>

        <SectionCard id="tags" title="Tags and keywords" description="Used for filtering your library and for matching job descriptions.">
          <div className="grid gap-4 sm:grid-cols-2">
            <TagInput label="Tags" value={draft.tags} onChange={(v) => set({ tags: v })} placeholder="e.g. frontend" />
            <TagInput label="Keywords" value={draft.keywords} onChange={(v) => set({ keywords: v })} placeholder="e.g. authentication" />
          </div>
        </SectionCard>

        <SectionCard
          id="bullets"
          title="Resume bullets"
          description="Each bullet should say what you did and what came of it. Start with a verb. Do not include a number you cannot defend in an interview."
        >
          <div className="space-y-3">
            <BulletList mode="library" bullets={draft.bullets} onChange={(bullets) => set({ bullets })} errors={errors} />
            {unverified > 0 ? (
              <Notice tone="warn">
                {unverified} {unverified === 1 ? 'bullet is' : 'bullets are'} not marked verified. Resumes will warn you before export.
              </Notice>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard id="notes" title="Private notes" description="Never printed on a resume.">
          <div className="space-y-4">
            <TextArea label="Notes" rows={3} value={draft.notes} onChange={(v) => set({ notes: v })} error={errors.notes} />
            <SelectField
              label="Status"
              value={draft.status}
              onChange={(v) => set({ status: v as Draft['status'] })}
              options={[
                { value: 'active', label: 'Active (available for new resumes)' },
                { value: 'archived', label: 'Archived (hidden from pickers)' },
              ]}
              className="max-w-sm"
            />
          </div>
        </SectionCard>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <div className="border-line bg-surface shadow-card rounded-xl border p-5">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {initial ? (
              archived ? (
                <Badge tone="warn">Archived</Badge>
              ) : (
                <Badge tone="ok">Active</Badge>
              )
            ) : (
              <Badge tone="brand">New project</Badge>
            )}
            {initial && initial.usedInCount > 0 ? (
              <Badge>
                Used in {initial.usedInCount} {initial.usedInCount === 1 ? 'resume' : 'resumes'}
              </Badge>
            ) : null}
            {initial?.sourceKey ? <Badge title="Imported from the project knowledge base">Imported</Badge> : null}
            {initial ? dirty ? <Badge tone="warn">Unsaved</Badge> : <Badge tone="ok">Saved</Badge> : null}
          </div>
          <Button
            variant="primary"
            className="w-full"
            loading={saving}
            disabled={initial ? !dirty : false}
            onClick={() => persist(draft, 'Project saved.')}
          >
            {saveLabel}
          </Button>
          {initial ? (
            <div className="mt-2 flex gap-2">
              <Button
                className="flex-1"
                disabled={saving}
                onClick={() =>
                  persist({ ...draft, status: archived ? 'active' : 'archived' }, archived ? 'Project restored.' : 'Project archived.')
                }
              >
                {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
                {archived ? 'Restore' : 'Archive'}
              </Button>
              <Button variant="danger-ghost" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden />
                Delete
              </Button>
            </div>
          ) : null}
        </div>

        <nav aria-label="On this page" className="border-line bg-surface shadow-card hidden rounded-xl border p-3 lg:block">
          <p className="text-muted mb-1.5 px-2 text-[11px] font-semibold tracking-wider uppercase">On this page</p>
          <ul>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-ink-2 hover:bg-sunken hover:text-brand block rounded-md px-2 py-1.5 text-[13px]">
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this project?"
        confirmLabel="Delete project"
        danger
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      >
        <p>
          <strong>{initial?.name}</strong> will be removed from your library.
        </p>
        <p className="text-muted mt-2">
          {initial && initial.usedInCount > 0
            ? `It is used in ${initial.usedInCount} ${initial.usedInCount === 1 ? 'resume' : 'resumes'}. Those resumes keep their own copy. If you only want it out of the way, archive it instead.`
            : 'No resume uses it. If you might want it later, archive it instead.'}
        </p>
      </ConfirmDialog>
    </div>
  );
}
