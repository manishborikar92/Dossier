'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Archive, ArchiveRestore, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import { issuesToFields, projectSchema } from '@/lib/schemas';
import type { Project } from '@/lib/types';
import { BulletList, type EditableBullet } from './BulletList';
import { Badge, Button, ConfirmDialog, SelectField, TagInput, TextArea, TextField, useToast } from './ui';

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
  name: '', category: '', overview: '', description: '', problem: '', solution: '', role: '', contributions: '',
  technologies: [], features: '', decisions: '', results: '', repoUrl: '', demoUrl: '', docsUrl: '', tags: [],
  keywords: [], yearLabel: '', family: '', status: 'active', notes: '', bullets: [],
};

function toDraft(p: Project): Draft {
  return { ...p, bullets: p.bullets.map((b) => ({ id: b.id, text: b.text, verified: b.verified })) };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-rule bg-surface p-5">
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      {hint ? <p className="mb-4 text-sm text-muted">{hint}</p> : <div className="mb-4" />}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function ProjectForm({ initial }: { initial: Project | null }) {
  const router = useRouter();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(initial ? toDraft(initial) : BLANK);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

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
        const saved = await api<Project>(`/api/library/projects/${initial.id}`, { method: 'PUT', body: parsed.data });
        setDraft(toDraft(saved));
        toast.success(message);
        router.refresh();
      } else {
        const created = await api<Project>('/api/library/projects', { body: parsed.data });
        toast.success('Project added.');
        router.push(`/projects/${created.id}`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!initial) return;
    setDeleting(true);
    try {
      await api(`/api/library/projects/${initial.id}`, { method: 'DELETE' });
      toast.success('Project deleted.');
      router.push('/projects');
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
    }
  }

  const archived = draft.status === 'archived';
  const unverified = draft.bullets.filter((b) => !b.verified).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link href="/projects" className="text-navy underline underline-offset-2">All projects</Link>
        {initial ? (
          <>
            <span aria-hidden>/</span>
            {archived ? <Badge tone="warn">Archived</Badge> : <Badge tone="ok">Active</Badge>}
            {initial.usedInCount > 0 ? <Badge>Used in {initial.usedInCount} {initial.usedInCount === 1 ? 'resume' : 'resumes'}</Badge> : null}
            {initial.sourceKey ? <Badge title="Imported from the project knowledge base">Imported</Badge> : null}
          </>
        ) : null}
      </div>

      <Section title="The basics">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Project name" required value={draft.name} onChange={(v) => set({ name: v })} error={errors.name} className="sm:col-span-2" hint="As it should read on a resume, e.g. CA-Workflow – Workflow Management Platform" />
          <TextField label="Category" value={draft.category} onChange={(v) => set({ category: v })} error={errors.category} hint="e.g. Web app, Desktop tool, Machine learning" />
          <TextField label="Year or period" value={draft.yearLabel} onChange={(v) => set({ yearLabel: v })} error={errors.yearLabel} hint="Printed on the resume, e.g. 2025 or 2024 – 2025" />
          <TextField label="Family" value={draft.family} onChange={(v) => set({ family: v })} error={errors.family} hint="Use the same name for repositories that make up one product." className="sm:col-span-2" />
        </div>
      </Section>

      <Section title="What it is" hint="Plain facts. These feed suggestions and help you write bullets later.">
        <TextArea label="Overview" rows={2} value={draft.overview} onChange={(v) => set({ overview: v })} error={errors.overview} hint="One or two sentences: what it is and who it is for." />
        <TextArea label="Detailed description" rows={4} value={draft.description} onChange={(v) => set({ description: v })} error={errors.description} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label="Problem it addresses" rows={3} value={draft.problem} onChange={(v) => set({ problem: v })} error={errors.problem} />
          <TextArea label="Solution you implemented" rows={3} value={draft.solution} onChange={(v) => set({ solution: v })} error={errors.solution} />
        </div>
      </Section>

      <Section title="Your part in it" hint="Be exact. Say whether you worked alone or in a team, because an interviewer will ask.">
        <TextArea label="Your role" rows={2} value={draft.role} onChange={(v) => set({ role: v })} error={errors.role} />
        <TextArea label="What you personally built or decided" rows={3} value={draft.contributions} onChange={(v) => set({ contributions: v })} error={errors.contributions} />
      </Section>

      <Section title="Technology">
        <TagInput label="Technologies and tools" value={draft.technologies} onChange={(v) => set({ technologies: v })} hint="Press Enter or type a comma after each one. These are matched against job descriptions." placeholder="e.g. Next.js" />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextArea label="Important features" rows={3} value={draft.features} onChange={(v) => set({ features: v })} error={errors.features} />
          <TextArea label="Technical decisions" rows={3} value={draft.decisions} onChange={(v) => set({ decisions: v })} error={errors.decisions} hint="What you chose and why." />
        </div>
      </Section>

      <Section title="Results" hint="Only results you can verify, such as users, uptime or time saved. Leave this empty if you do not know.">
        <TextArea label="Verified results" rows={3} value={draft.results} onChange={(v) => set({ results: v })} error={errors.results} />
      </Section>

      <Section title="Links">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Repository" value={draft.repoUrl} onChange={(v) => set({ repoUrl: v })} error={errors.repoUrl} placeholder="https://" />
          <TextField label="Live demo" value={draft.demoUrl} onChange={(v) => set({ demoUrl: v })} error={errors.demoUrl} placeholder="https://" />
          <TextField label="Documentation" value={draft.docsUrl} onChange={(v) => set({ docsUrl: v })} error={errors.docsUrl} placeholder="https://" />
        </div>
      </Section>

      <Section title="Tags and keywords" hint="Used for filtering your library and for matching job descriptions.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TagInput label="Tags" value={draft.tags} onChange={(v) => set({ tags: v })} placeholder="e.g. frontend" />
          <TagInput label="Keywords" value={draft.keywords} onChange={(v) => set({ keywords: v })} placeholder="e.g. authentication" />
        </div>
      </Section>

      <Section title="Resume bullets" hint="Each bullet should say what you did and what came of it. Start with a verb. Do not include a number you cannot defend in an interview.">
        <BulletList mode="library" bullets={draft.bullets} onChange={(bullets) => set({ bullets })} errors={errors} />
        {unverified > 0 ? <p className="text-sm text-warn">{unverified} {unverified === 1 ? 'bullet is' : 'bullets are'} not marked verified. Resumes will warn you before export.</p> : null}
      </Section>

      <Section title="Private notes" hint="Never printed on a resume.">
        <TextArea label="Notes" rows={3} value={draft.notes} onChange={(v) => set({ notes: v })} error={errors.notes} />
        <SelectField label="Status" value={draft.status} onChange={(v) => set({ status: v as Draft['status'] })} options={[{ value: 'active', label: 'Active (available for new resumes)' }, { value: 'archived', label: 'Archived (hidden from pickers)' }]} className="max-w-sm" />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-rule bg-paper/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-2">
          {initial ? (
            <>
              <Button onClick={() => persist({ ...draft, status: archived ? 'active' : 'archived' }, archived ? 'Project restored.' : 'Project archived.')} disabled={saving}>
                {archived ? <ArchiveRestore className="h-4 w-4" aria-hidden /> : <Archive className="h-4 w-4" aria-hidden />}
                {archived ? 'Restore' : 'Archive'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-bad">
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete
              </Button>
            </>
          ) : null}
        </div>
        <Button variant="primary" loading={saving} onClick={() => persist(draft, 'Project saved.')}>
          {initial ? 'Save changes' : 'Add project'}
        </Button>
      </div>

      <ConfirmDialog open={confirmDelete} title="Delete this project?" confirmLabel="Delete project" danger busy={deleting} onConfirm={remove} onCancel={() => setConfirmDelete(false)}>
        <p>
          <strong>{initial?.name}</strong> will be removed from your library.
        </p>
        <p className="mt-2 text-muted">
          {initial && initial.usedInCount > 0
            ? `It is used in ${initial.usedInCount} ${initial.usedInCount === 1 ? 'resume' : 'resumes'}. Those resumes keep their own copy. If you only want it out of the way, archive it instead.`
            : 'No resume uses it. If you might want it later, archive it instead.'}
        </p>
      </ConfirmDialog>
    </div>
  );
}
