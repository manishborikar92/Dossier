'use client';

import { Copy, FileText, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { buttonClass } from '@/lib/classes';
import { formatDateTime } from '@/lib/format';
import { issuesToFields, resumeCreateSchema } from '@/lib/schemas';
import { TEMPLATES } from '@/lib/templates';
import type { ResumeListEntry, TemplateId } from '@/lib/types';
import { Badge, Button, Card, ConfirmDialog, Dialog, EmptyState, Notice, TextArea, TextField, useToast } from '../ui';
import { TemplatePicker } from './TemplatePicker';

type Preselect = 'none' | 'top' | 'match';

const PRESELECT_OPTIONS: { value: Preselect; label: string }[] = [
  { value: 'top', label: 'The first three active projects in my library order' },
  { value: 'match', label: 'The three that best match the job description (needs one above)' },
  { value: 'none', label: 'None. I will choose them myself' },
];

interface Props {
  initial: ResumeListEntry[];
  canCreate: boolean;
  defaultTemplate: TemplateId;
}

export function ResumesManager({ initial, canCreate, defaultTemplate }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [resumes, setResumes] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [dupOf, setDupOf] = useState<ResumeListEntry | null>(null);
  const [dupName, setDupName] = useState('');
  const [delTarget, setDelTarget] = useState<ResumeListEntry | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: '',
    targetTitle: '',
    targetCompany: '',
    template: defaultTemplate,
    jdText: '',
    preselect: 'top' as Preselect,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function create() {
    const parsed = resumeCreateSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesToFields(parsed.error.issues));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const res = await api.resumes.create(parsed.data);
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
      const copy = await api.resumes.duplicate(dupOf.id, dupName);
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
      await api.resumes.remove(delTarget.id);
      setResumes(await api.resumes.list());
      toast.success('Resume deleted.');
      setDelTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const newButton = (
    <Button variant="primary" onClick={() => setCreating(true)} disabled={!canCreate}>
      <Plus className="size-4" aria-hidden />
      New resume
    </Button>
  );

  return (
    <div>
      {!canCreate ? (
        <Notice tone="warn" className="mb-5">
          Add your name on the{' '}
          <Link href="/profile" className="font-semibold underline underline-offset-2">
            Profile
          </Link>{' '}
          page first. Every resume starts from it.
        </Notice>
      ) : null}

      {resumes.length === 0 ? (
        <EmptyState icon={FileText} title="No resumes yet" action={canCreate ? newButton : undefined}>
          A resume is a selection from your library: which projects, which experience, which wording, and which template. Make as many as
          you need.
        </EmptyState>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <p className="text-muted text-sm">
              {resumes.length} {resumes.length === 1 ? 'resume' : 'resumes'}
            </p>
            {newButton}
          </div>
          <ul className="grid gap-4 md:grid-cols-2">
            {resumes.map((r) => (
              <li key={r.id}>
                <Card className="flex h-full flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link
                      href={`/resumes/${r.id}`}
                      className="text-ink hover:text-brand text-base leading-snug font-semibold tracking-tight"
                    >
                      {r.name}
                    </Link>
                    <Badge tone={r.status === 'final' ? 'ok' : 'neutral'}>{r.status === 'final' ? 'Final' : 'Draft'}</Badge>
                  </div>
                  <p className="text-muted mt-0.5 text-sm">
                    {[r.targetTitle, r.targetCompany].filter(Boolean).join(' at ') || 'No target role set'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Badge tone="brand">{TEMPLATES[r.template].label}</Badge>
                    <Badge>
                      {r.projectCount} {r.projectCount === 1 ? 'project' : 'projects'}
                    </Badge>
                    <Badge>
                      {r.versionCount} {r.versionCount === 1 ? 'version' : 'versions'}
                    </Badge>
                    {r.outdatedCount > 0 ? <Badge tone="warn">{r.outdatedCount} changed in library</Badge> : null}
                    {r.parentId ? <Badge title="Created by duplicating another resume">Copy</Badge> : null}
                  </div>
                  {r.outdatedCount > 0 ? (
                    <div className="bg-warn-soft/40 border border-warn/25 rounded-lg px-3 py-2 mt-3 flex items-center justify-between text-xs">
                      <span className="text-ink font-medium">
                        ⚠️ {r.outdatedCount} {r.outdatedCount === 1 ? 'item' : 'items'} changed in library
                      </span>
                      <Link href={`/resumes/${r.id}?review=1`} className="text-warn font-semibold hover:underline ml-2">
                        Review
                      </Link>
                    </div>
                  ) : null}
                  <p className="text-muted mt-3 text-xs" suppressHydrationWarning>
                    Updated {formatDateTime(r.updatedAt)}
                  </p>
                  <div className="border-line mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
                    <Link href={`/resumes/${r.id}`} className={buttonClass('primary', 'sm')}>
                      Open
                    </Link>
                    <Button
                      size="sm"
                      onClick={() => {
                        setDupOf(r);
                        setDupName(`Copy of ${r.name}`.slice(0, 120));
                      }}
                    >
                      <Copy className="size-3.5" aria-hidden />
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="danger-ghost"
                      className="ml-auto"
                      onClick={() => setDelTarget(r)}
                      aria-label={`Delete ${r.name}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                      Delete
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog
        open={creating}
        onClose={() => !busy && setCreating(false)}
        title="New resume"
        description="Start from your library. You can change everything afterwards."
        size="lg"
        footer={
          <>
            <Button onClick={() => setCreating(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={create}>
              Create resume
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <TextField
            label="Resume name"
            required
            value={form.name}
            onChange={(v) => set({ name: v })}
            error={errors.name}
            hint="For your own use, e.g. Frontend developer – general"
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Target job title"
              value={form.targetTitle}
              onChange={(v) => set({ targetTitle: v })}
              error={errors.targetTitle}
            />
            <TextField
              label="Target company"
              value={form.targetCompany}
              onChange={(v) => set({ targetCompany: v })}
              error={errors.targetCompany}
            />
          </div>
          <TemplatePicker value={form.template} onChange={(template) => set({ template })} name="new-resume-template" />
          <TextArea
            label="Job description (optional)"
            rows={5}
            value={form.jdText}
            onChange={(v) => set({ jdText: v })}
            error={errors.jdText}
            hint="Paste it to get project and keyword suggestions. Nothing is added to your resume without you choosing it."
          />
          <fieldset>
            <legend className="text-ink-2 mb-1.5 text-[13px] font-medium">Which projects to start with</legend>
            <div className="space-y-1.5 text-sm">
              {PRESELECT_OPTIONS.map(({ value, label }) => (
                <label key={value} className="text-ink-2 flex items-center gap-2">
                  <input
                    type="radio"
                    name="preselect"
                    checked={form.preselect === value}
                    onChange={() => set({ preselect: value })}
                    className="accent-brand"
                  />
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
        description="The copy is independent. Editing it never changes the original."
        size="sm"
        footer={
          <>
            <Button onClick={() => setDupOf(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={duplicate}>
              Duplicate
            </Button>
          </>
        }
      >
        <TextField label="Name of the copy" value={dupName} onChange={setDupName} autoFocus />
      </Dialog>

      <ConfirmDialog
        open={delTarget !== null}
        title="Delete this resume?"
        confirmLabel="Delete resume"
        danger
        busy={busy}
        onConfirm={remove}
        onCancel={() => setDelTarget(null)}
      >
        <p>
          <strong>{delTarget?.name}</strong> and its {delTarget?.versionCount ?? 0} saved{' '}
          {delTarget?.versionCount === 1 ? 'version' : 'versions'} will be deleted. Your library is not affected.
        </p>
        <p className="text-muted mt-2">This cannot be undone, except by restoring a backup. Download a backup first if you are unsure.</p>
      </ConfirmDialog>
    </div>
  );
}
