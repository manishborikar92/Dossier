'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import { issuesToFields, resumeCreateSchema, TEMPLATE_IDS } from '@/lib/schemas';
import { TEMPLATES } from '@/lib/templates';
import type { ResumeListEntry } from '@/server/resumes';
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, TextArea, TextField, buttonClass, useToast } from './ui';

type Preselect = 'none' | 'top' | 'match';

export function ResumesManager({ initial, canCreate, defaultTemplate }: { initial: ResumeListEntry[]; canCreate: boolean; defaultTemplate: string }) {
  const router = useRouter();
  const toast = useToast();
  const [resumes, setResumes] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [dupOf, setDupOf] = useState<ResumeListEntry | null>(null);
  const [dupName, setDupName] = useState('');
  const [delTarget, setDelTarget] = useState<ResumeListEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: '', targetTitle: '', targetCompany: '', template: defaultTemplate, jdText: '', preselect: 'top' as Preselect });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const reload = async () => setResumes(await api<ResumeListEntry[]>('/api/resumes'));

  async function create() {
    const parsed = resumeCreateSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesToFields(parsed.error.issues));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api<{ resume: { id: number } }>('/api/resumes', { body: parsed.data });
      toast.success('Resume created.');
      router.push(`/resumes/${res.resume.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function duplicate() {
    if (!dupOf) return;
    setBusy(true);
    try {
      const copy = await api<{ id: number }>(`/api/resumes/${dupOf.id}/duplicate`, { body: { name: dupName } });
      toast.success('Resume duplicated.');
      router.push(`/resumes/${copy.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setBusy(false);
    }
  }

  async function remove() {
    if (!delTarget) return;
    setBusy(true);
    try {
      await api(`/api/resumes/${delTarget.id}`, { method: 'DELETE' });
      await reload();
      toast.success('Resume deleted.');
      setDelTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="primary" onClick={() => setCreating(true)} disabled={!canCreate}>
          <Plus className="h-4 w-4" aria-hidden />
          New resume
        </Button>
      </div>
      {!canCreate ? (
        <p className="mb-4 rounded-md bg-warn-bg p-3 text-sm text-warn">
          Add your name on the <Link href="/profile" className="font-medium underline underline-offset-2">Profile</Link> page first. Every resume starts from it.
        </p>
      ) : null}

      {resumes.length === 0 ? (
        <EmptyState title="No resumes yet" action={canCreate ? <Button variant="primary" onClick={() => setCreating(true)}>Create your first resume</Button> : undefined}>
          A resume is a selection from your library: which projects, which experience, which wording, and which template. Make as many as you need.
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {resumes.map((r) => (
            <li key={r.id} className="flex flex-col rounded-lg border border-rule bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/resumes/${r.id}`} className="font-serif text-lg font-semibold text-navy underline-offset-2 hover:underline">
                  {r.name}
                </Link>
                <Badge tone={r.status === 'final' ? 'ok' : 'neutral'}>{r.status === 'final' ? 'Final' : 'Draft'}</Badge>
              </div>
              <p className="text-sm text-muted">{[r.targetTitle, r.targetCompany].filter(Boolean).join(' at ') || 'No target role set'}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>{TEMPLATES[r.template].label}</Badge>
                <Badge>{r.projectCount} {r.projectCount === 1 ? 'project' : 'projects'}</Badge>
                <Badge>{r.versionCount} {r.versionCount === 1 ? 'version' : 'versions'}</Badge>
                {r.outdatedCount > 0 ? <Badge tone="warn">{r.outdatedCount} changed in library</Badge> : null}
                {r.parentId ? <Badge title="Created by duplicating another resume">Copy</Badge> : null}
              </div>
              <p className="mt-2 text-xs text-muted">Updated {formatDateTime(r.updatedAt)}</p>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-rule pt-3">
                <Link href={`/resumes/${r.id}`} className={buttonClass('primary', 'sm')}>Open</Link>
                <Button size="sm" onClick={() => { setDupOf(r); setDupName(`Copy of ${r.name}`.slice(0, 120)); }}>
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Duplicate
                </Button>
                <Button size="sm" variant="ghost" className="ml-auto text-bad" onClick={() => setDelTarget(r)} aria-label={`Delete ${r.name}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={creating}
        onClose={() => !busy && setCreating(false)}
        title="New resume"
        wide
        footer={
          <>
            <Button onClick={() => setCreating(false)} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={create}>Create resume</Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField label="Resume name" required value={form.name} onChange={(v) => set({ name: v })} error={errors.name} hint="For your own use, e.g. Frontend developer – general" autoFocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Target job title" value={form.targetTitle} onChange={(v) => set({ targetTitle: v })} error={errors.targetTitle} />
            <TextField label="Target company" value={form.targetCompany} onChange={(v) => set({ targetCompany: v })} error={errors.targetCompany} />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Template</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TEMPLATE_IDS.map((id) => (
                <label key={id} className={`cursor-pointer rounded-md border p-2.5 text-sm ${form.template === id ? 'border-navy bg-navy-soft' : 'border-rule'}`}>
                  <input type="radio" name="template" value={id} checked={form.template === id} onChange={() => set({ template: id })} className="mr-2 accent-navy" />
                  <span className="font-medium">{TEMPLATES[id].label}</span>
                  <span className="mt-1 block text-xs text-muted">{TEMPLATES[id].description}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <TextArea label="Job description (optional)" rows={5} value={form.jdText} onChange={(v) => set({ jdText: v })} error={errors.jdText} hint="Paste it to get project and keyword suggestions. Nothing is added to your resume without you choosing it." />
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Which projects to start with</legend>
            <div className="space-y-1.5 text-sm">
              {([
                ['top', 'The first three active projects in my library order'],
                ['match', 'The three that best match the job description (needs one above)'],
                ['none', 'None. I will choose them myself'],
              ] as [Preselect, string][]).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input type="radio" name="preselect" checked={form.preselect === value} onChange={() => set({ preselect: value })} className="accent-navy" />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      </Dialog>

      <Dialog
        open={dupOf !== null}
        onClose={() => !busy && setDupOf(null)}
        title="Duplicate resume"
        footer={
          <>
            <Button onClick={() => setDupOf(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" loading={busy} onClick={duplicate}>Duplicate</Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">The copy is independent. Editing it never changes the original.</p>
        <TextField label="Name of the copy" value={dupName} onChange={setDupName} autoFocus />
      </Dialog>

      <ConfirmDialog open={delTarget !== null} title="Delete this resume?" confirmLabel="Delete resume" danger busy={busy} onConfirm={remove} onCancel={() => setDelTarget(null)}>
        <p>
          <strong>{delTarget?.name}</strong> and its {delTarget?.versionCount ?? 0} saved {delTarget?.versionCount === 1 ? 'version' : 'versions'} will be deleted. Your library is not affected.
        </p>
        <p className="mt-2 text-muted">This cannot be undone, except by restoring a backup. Download a backup first if you are unsure.</p>
      </ConfirmDialog>
    </div>
  );
}
