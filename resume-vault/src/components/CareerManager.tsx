'use client';

import { useCallback, useState, type ReactNode } from 'react';
import type { z } from 'zod';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import { formatRange } from '@/lib/format';
import { certificationSchema, educationSchema, experienceSchema, issuesToFields, skillSchema, EXPERIENCE_KINDS } from '@/lib/schemas';
import type { Certification, Education, EntityName, Experience, Skill } from '@/lib/types';
import { BulletList, type EditableBullet } from './BulletList';
import { Badge, Button, CheckField, ConfirmDialog, Dialog, EmptyState, MonthField, SelectField, Tabs, TextArea, TextField, useToast } from './ui';

type Tab = 'experience' | 'education' | 'skills' | 'certifications';
interface Used {
  id: number;
  usedInCount: number;
}

/* ---------- shared list + editor plumbing ---------- */

function useEntityList<T extends Used>(entity: EntityName, initial: T[]) {
  const toast = useToast();
  const [items, setItems] = useState<T[]>(initial);
  const reload = useCallback(async () => {
    setItems(await api<T[]>(`/api/library/${entity}`));
  }, [entity]);
  const move = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    setItems(next);
    try {
      await api(`/api/library/${entity}/reorder`, { body: { ids: next.map((i) => i.id) } });
    } catch (error) {
      toast.error(errorMessage(error));
      await reload();
    }
  };
  return { items, reload, move };
}

function useEntityEditor<D extends object>(entity: EntityName, schema: z.ZodType, onSaved: () => Promise<void>, savedMessage: string) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: number | null; draft: D } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const open = (draft: D, id: number | null = null) => {
    setErrors({});
    setEditing({ id, draft });
  };
  const patch = (changes: Partial<D>) => setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...changes } } : e));
  const save = async () => {
    if (!editing) return;
    const parsed = schema.safeParse(editing.draft);
    if (!parsed.success) {
      setErrors(issuesToFields(parsed.error.issues));
      return;
    }
    setSaving(true);
    try {
      if (editing.id === null) await api(`/api/library/${entity}`, { body: parsed.data });
      else await api(`/api/library/${entity}/${editing.id}`, { method: 'PUT', body: parsed.data });
      await onSaved();
      toast.success(savedMessage);
      setEditing(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return { editing, errors, saving, open, patch, save, close: () => setEditing(null) };
}

function useDeleter(entity: EntityName, onDeleted: () => Promise<void>, noun: string) {
  const toast = useToast();
  const [target, setTarget] = useState<(Used & { label: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api(`/api/library/${entity}/${target.id}`, { method: 'DELETE' });
      await onDeleted();
      toast.success(`${noun} deleted.`);
      setTarget(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const dialog = (
    <ConfirmDialog open={target !== null} title={`Delete this ${noun.toLowerCase()}?`} confirmLabel="Delete" danger busy={busy} onConfirm={confirm} onCancel={() => setTarget(null)}>
      <p>
        <strong>{target?.label}</strong> will be removed from your library.
      </p>
      <p className="mt-2 text-muted">
        {target && target.usedInCount > 0
          ? `It is used in ${target.usedInCount} ${target.usedInCount === 1 ? 'resume' : 'resumes'}. Those resumes keep their own copy, so nothing already written changes.`
          : 'No resume uses it yet.'}
      </p>
    </ConfirmDialog>
  );
  return { ask: (item: Used, label: string) => setTarget({ ...item, label }), dialog };
}

function RowActions({ index, count, onMove, onEdit, onDelete, label }: { index: number; count: number; onMove: (dir: -1 | 1) => void; onEdit: () => void; onDelete: () => void; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button type="button" aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(-1)} className="rounded p-1.5 text-muted hover:bg-navy-soft disabled:opacity-30">
        <ArrowUp className="h-4 w-4" aria-hidden />
      </button>
      <button type="button" aria-label={`Move ${label} down`} disabled={index === count - 1} onClick={() => onMove(1)} className="rounded p-1.5 text-muted hover:bg-navy-soft disabled:opacity-30">
        <ArrowDown className="h-4 w-4" aria-hidden />
      </button>
      <Button size="sm" onClick={onEdit} aria-label={`Edit ${label}`}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Edit
      </Button>
      <button type="button" aria-label={`Delete ${label}`} onClick={onDelete} className="rounded p-1.5 text-muted hover:bg-bad-bg hover:text-bad">
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function FormDialog({ open, title, onClose, onSave, saving, children, wide }: { open: boolean; title: string; onClose: () => void; onSave: () => void; saving: boolean; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      wide={wide}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={saving} onClick={onSave}>
            Save
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}

const usedBadge = (n: number) => (n > 0 ? <Badge title="Resumes that contain a copy of this">Used in {n}</Badge> : null);

/* ---------- experience ---------- */

interface ExperienceDraft {
  org: string;
  title: string;
  location: string;
  start: string;
  end: string;
  kind: string;
  description: string;
  archived: boolean;
  bullets: EditableBullet[];
}
const blankExperience: ExperienceDraft = { org: '', title: '', location: '', start: '', end: '', kind: 'job', description: '', archived: false, bullets: [] };
const KIND_LABEL: Record<string, string> = { job: 'Job', internship: 'Internship', freelance: 'Freelance', leadership: 'Leadership', volunteer: 'Volunteer' };

function ExperienceSection({ initial }: { initial: Experience[] }) {
  const list = useEntityList<Experience>('experiences', initial);
  const editor = useEntityEditor<ExperienceDraft>('experiences', experienceSchema, list.reload, 'Experience saved.');
  const del = useDeleter('experiences', list.reload, 'Experience');
  const d = editor.editing?.draft;

  return (
    <section aria-label="Experience">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Jobs, internships, freelance work and leadership roles. Leadership and volunteer entries get their own section on a resume.</p>
        <Button variant="primary" onClick={() => editor.open(blankExperience)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add experience
        </Button>
      </div>
      {list.items.length === 0 ? (
        <EmptyState title="No experience yet" action={<Button variant="primary" onClick={() => editor.open(blankExperience)}>Add your first role</Button>}>
          Add each role once, with the achievements you can stand behind. Resumes pick from them.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
          {list.items.map((e, i) => (
            <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">
                  {e.title} <span className="font-normal text-muted">at {e.org}</span>
                </p>
                <p className="text-sm text-muted">{formatRange(e.start, e.end)}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>{KIND_LABEL[e.kind]}</Badge>
                  {e.bullets.length > 0 ? <Badge>{e.bullets.length} {e.bullets.length === 1 ? 'bullet' : 'bullets'}</Badge> : null}
                  {e.bullets.some((b) => !b.verified) ? <Badge tone="warn">Unverified bullets</Badge> : null}
                  {e.archived ? <Badge tone="warn">Hidden from new resumes</Badge> : null}
                  {usedBadge(e.usedInCount)}
                </div>
              </div>
              <RowActions
                index={i}
                count={list.items.length}
                label={e.title}
                onMove={(dir) => list.move(i, dir)}
                onEdit={() => editor.open({ ...e, bullets: e.bullets.map((b) => ({ id: b.id, text: b.text, verified: b.verified })) }, e.id)}
                onDelete={() => del.ask(e, `${e.title} at ${e.org}`)}
              />
            </li>
          ))}
        </ul>
      )}

      <FormDialog open={!!editor.editing} title={editor.editing?.id ? 'Edit experience' : 'Add experience'} onClose={editor.close} onSave={editor.save} saving={editor.saving} wide>
        {d ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Type" value={d.kind} onChange={(v) => editor.patch({ kind: v })} options={EXPERIENCE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
              <TextField label="Title" required value={d.title} onChange={(v) => editor.patch({ title: v })} error={editor.errors.title} />
              <TextField label="Organization" required value={d.org} onChange={(v) => editor.patch({ org: v })} error={editor.errors.org} />
              <TextField label="Location" value={d.location} onChange={(v) => editor.patch({ location: v })} error={editor.errors.location} />
              <MonthField label="Start" required value={d.start} onChange={(v) => editor.patch({ start: v })} error={editor.errors.start} />
              <div>
                <MonthField label="End" value={d.end} onChange={(v) => editor.patch({ end: v })} error={editor.errors.end} hint="Leave empty if this is current." />
              </div>
            </div>
            <TextArea
              label="Description"
              value={d.description}
              onChange={(v) => editor.patch({ description: v })}
              error={editor.errors.description}
              hint={
                d.kind === 'leadership' || d.kind === 'volunteer'
                  ? 'Printed after the organisation name on the same grey line, joined with a dash, so it reads best as a continuing phrase such as "led a team that...".'
                  : 'Optional short paragraph printed under the title.'
              }
            />
            <BulletList mode="library" bullets={d.bullets} onChange={(bullets) => editor.patch({ bullets })} errors={editor.errors} />
            <CheckField label="Hide from new resumes" checked={d.archived} onChange={(v) => editor.patch({ archived: v })} hint="Existing resumes are not affected." />
          </div>
        ) : null}
      </FormDialog>
      {del.dialog}
    </section>
  );
}

/* ---------- education ---------- */

type EducationDraft = Omit<Education, 'id' | 'version' | 'sort' | 'usedInCount' | 'createdAt' | 'updatedAt'>;
const blankEducation: EducationDraft = { institution: '', degree: '', field: '', location: '', start: '', end: '', grade: '', details: '' };

function EducationSection({ initial }: { initial: Education[] }) {
  const list = useEntityList<Education>('education', initial);
  const editor = useEntityEditor<EducationDraft>('education', educationSchema, list.reload, 'Education saved.');
  const del = useDeleter('education', list.reload, 'Education entry');
  const d = editor.editing?.draft;
  return (
    <section aria-label="Education">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Degrees, diplomas and school qualifications.</p>
        <Button variant="primary" onClick={() => editor.open(blankEducation)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add education
        </Button>
      </div>
      {list.items.length === 0 ? (
        <EmptyState title="No education yet" action={<Button variant="primary" onClick={() => editor.open(blankEducation)}>Add education</Button>}>
          Add your degrees and qualifications once. Each resume can show or hide them.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
          {list.items.map((e, i) => (
            <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{[e.degree, e.field].filter(Boolean).join(' \u2013 ')}</p>
                <p className="text-sm text-muted">{[e.institution, e.grade, formatRange(e.start, e.end)].filter(Boolean).join(' \u00b7 ')}</p>
                <div className="mt-1">{usedBadge(e.usedInCount)}</div>
              </div>
              <RowActions index={i} count={list.items.length} label={e.degree} onMove={(dir) => list.move(i, dir)} onEdit={() => editor.open({ ...e }, e.id)} onDelete={() => del.ask(e, `${e.degree}, ${e.institution}`)} />
            </li>
          ))}
        </ul>
      )}
      <FormDialog open={!!editor.editing} title={editor.editing?.id ? 'Edit education' : 'Add education'} onClose={editor.close} onSave={editor.save} saving={editor.saving}>
        {d ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Degree or qualification" required value={d.degree} onChange={(v) => editor.patch({ degree: v })} error={editor.errors.degree} className="sm:col-span-2" hint="For example: B.Tech" />
            <TextField label="Field of study" value={d.field} onChange={(v) => editor.patch({ field: v })} error={editor.errors.field} />
            <TextField label="Institution" required value={d.institution} onChange={(v) => editor.patch({ institution: v })} error={editor.errors.institution} />
            <TextField label="Location" value={d.location} onChange={(v) => editor.patch({ location: v })} error={editor.errors.location} />
            <TextField label="Grade or score" value={d.grade} onChange={(v) => editor.patch({ grade: v })} error={editor.errors.grade} hint="Printed as you type it, e.g. CGPA: 8.1/10" />
            <MonthField label="Start" value={d.start} onChange={(v) => editor.patch({ start: v })} error={editor.errors.start} />
            <MonthField label="End or graduation" value={d.end} onChange={(v) => editor.patch({ end: v })} error={editor.errors.end} />
            <TextArea label="Details" value={d.details} onChange={(v) => editor.patch({ details: v })} error={editor.errors.details} className="sm:col-span-2" />
          </div>
        ) : null}
      </FormDialog>
      {del.dialog}
    </section>
  );
}

/* ---------- skills ---------- */

type SkillDraft = { name: string; category: string };

function SkillsSection({ initial }: { initial: Skill[] }) {
  const list = useEntityList<Skill>('skills', initial);
  const editor = useEntityEditor<SkillDraft>('skills', skillSchema, list.reload, 'Skill saved.');
  const del = useDeleter('skills', list.reload, 'Skill');
  const categories = [...new Set(list.items.map((s) => s.category))];
  const d = editor.editing?.draft;
  const grouped = categories.map((c) => ({ category: c, skills: list.items.map((s, index) => ({ s, index })).filter((x) => x.s.category === c) }));

  return (
    <section aria-label="Skills">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">List only skills you can talk about in an interview. Categories become the labels on your resume.</p>
        <Button variant="primary" onClick={() => editor.open({ name: '', category: categories[0] ?? '' })}>
          <Plus className="h-4 w-4" aria-hidden />
          Add skill
        </Button>
      </div>
      {list.items.length === 0 ? (
        <EmptyState title="No skills yet" action={<Button variant="primary" onClick={() => editor.open({ name: '', category: 'Languages' })}>Add a skill</Button>}>
          Group skills into categories such as Languages, Frontend or Databases.
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {grouped.map((g) => (
            <div key={g.category} className="rounded-lg border border-rule bg-surface">
              <h3 className="border-b border-rule px-4 py-2 text-sm font-semibold">{g.category}</h3>
              <ul className="divide-y divide-rule">
                {g.skills.map(({ s, index }) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span className="text-sm">
                      {s.name} <span className="ml-1">{usedBadge(s.usedInCount)}</span>
                    </span>
                    <RowActions index={index} count={list.items.length} label={s.name} onMove={(dir) => list.move(index, dir)} onEdit={() => editor.open({ name: s.name, category: s.category }, s.id)} onDelete={() => del.ask(s, s.name)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <FormDialog open={!!editor.editing} title={editor.editing?.id ? 'Edit skill' : 'Add skill'} onClose={editor.close} onSave={editor.save} saving={editor.saving}>
        {d ? (
          <div className="space-y-4">
            <TextField label="Skill" required value={d.name} onChange={(v) => editor.patch({ name: v })} error={editor.errors.name} autoFocus />
            <TextField label="Category" required value={d.category} onChange={(v) => editor.patch({ category: v })} error={editor.errors.category} hint={categories.length ? `Existing categories: ${categories.join(', ')}` : 'For example: Languages'} />
          </div>
        ) : null}
      </FormDialog>
      {del.dialog}
    </section>
  );
}

/* ---------- certifications ---------- */

type CertDraft = { name: string; issuer: string; year: string; url: string };
const blankCert: CertDraft = { name: '', issuer: '', year: '', url: '' };

function CertificationsSection({ initial }: { initial: Certification[] }) {
  const list = useEntityList<Certification>('certifications', initial);
  const editor = useEntityEditor<CertDraft>('certifications', certificationSchema, list.reload, 'Certification saved.');
  const del = useDeleter('certifications', list.reload, 'Certification');
  const d = editor.editing?.draft;
  return (
    <section aria-label="Certifications">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Certificates and other qualifications.</p>
        <Button variant="primary" onClick={() => editor.open(blankCert)}>
          <Plus className="h-4 w-4" aria-hidden />
          Add certification
        </Button>
      </div>
      {list.items.length === 0 ? (
        <EmptyState title="No certifications yet" action={<Button variant="primary" onClick={() => editor.open(blankCert)}>Add a certification</Button>} />
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
          {list.items.map((c, i) => (
            <li key={c.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{c.name}</p>
                <p className="text-sm text-muted">{[c.issuer, c.year].filter(Boolean).join(' \u00b7 ')}</p>
                <div className="mt-1">{usedBadge(c.usedInCount)}</div>
              </div>
              <RowActions index={i} count={list.items.length} label={c.name} onMove={(dir) => list.move(i, dir)} onEdit={() => editor.open({ name: c.name, issuer: c.issuer, year: c.year, url: c.url }, c.id)} onDelete={() => del.ask(c, c.name)} />
            </li>
          ))}
        </ul>
      )}
      <FormDialog open={!!editor.editing} title={editor.editing?.id ? 'Edit certification' : 'Add certification'} onClose={editor.close} onSave={editor.save} saving={editor.saving}>
        {d ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Name" required value={d.name} onChange={(v) => editor.patch({ name: v })} error={editor.errors.name} className="sm:col-span-2" />
            <TextField label="Issuer" value={d.issuer} onChange={(v) => editor.patch({ issuer: v })} error={editor.errors.issuer} />
            <TextField label="Year" value={d.year} onChange={(v) => editor.patch({ year: v })} error={editor.errors.year} />
            <TextField label="Link to the certificate" value={d.url} onChange={(v) => editor.patch({ url: v })} error={editor.errors.url} placeholder="https://" className="sm:col-span-2" />
          </div>
        ) : null}
      </FormDialog>
      {del.dialog}
    </section>
  );
}

/* ---------- page component ---------- */

export function CareerManager({ initialTab, experiences, education, skills, certifications }: { initialTab: Tab; experiences: Experience[]; education: Education[]; skills: Skill[]; certifications: Certification[] }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <div>
      <Tabs
        label="Career data"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'experience', label: 'Experience', badge: <Badge>{experiences.length}</Badge> },
          { id: 'education', label: 'Education', badge: <Badge>{education.length}</Badge> },
          { id: 'skills', label: 'Skills', badge: <Badge>{skills.length}</Badge> },
          { id: 'certifications', label: 'Certifications', badge: <Badge>{certifications.length}</Badge> },
        ]}
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-5">
        {tab === 'experience' ? <ExperienceSection initial={experiences} /> : null}
        {tab === 'education' ? <EducationSection initial={education} /> : null}
        {tab === 'skills' ? <SkillsSection initial={skills} /> : null}
        {tab === 'certifications' ? <CertificationsSection initial={certifications} /> : null}
      </div>
    </div>
  );
}
