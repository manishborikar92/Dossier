'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { issuesToFields, itemDataSchemas, leadershipDataSchema } from '@/lib/schemas';
import type {
  CertificationData,
  EducationData,
  ExperienceData,
  HeaderData,
  ItemLink,
  ProjectData,
  ResumeItem,
  SkillData,
  SummaryData,
} from '@/lib/types';
import { BulletList } from '../BulletList';
import { Button, CheckField, MonthField, TextArea, TextField } from '../ui';

type Errors = Record<string, string>;

function LinksEditor({ links, onChange, errors }: { links: ItemLink[]; onChange: (l: ItemLink[]) => void; errors: Errors }) {
  const upd = (i: number, patch: Partial<ItemLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">Links</legend>
      <div className="space-y-2">
        {links.map((l, i) => (
          <div key={i} className="grid items-start gap-2 sm:grid-cols-[auto_1fr_1.4fr_auto]">
            <input type="checkbox" aria-label={`Show link ${i + 1} on this resume`} checked={l.show} onChange={(e) => upd(i, { show: e.target.checked })} className="mt-2.5 h-4 w-4 accent-navy" />
            <TextField label="Text" value={l.label} onChange={(v) => upd(i, { label: v })} error={errors[`links.${i}.label`]} />
            <TextField label="Address" value={l.url} placeholder="https://" onChange={(v) => upd(i, { url: v })} error={errors[`links.${i}.url`]} />
            <Button className="sm:mt-6" aria-label={`Remove link ${i + 1}`} onClick={() => onChange(links.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
      </div>
      <Button size="sm" className="mt-2" onClick={() => onChange([...links, { label: '', url: '', show: true }])}>
        <Plus className="h-4 w-4" aria-hidden />
        Add link
      </Button>
    </fieldset>
  );
}

function HeaderForm({ d, set, errors }: { d: HeaderData; set: (d: HeaderData) => void; errors: Errors }) {
  const show = (k: keyof HeaderData['show'], label: string, field: 'headline' | 'email' | 'phone' | 'location', type = 'text') => (
    <div className="space-y-1">
      <TextField label={label} type={type} value={d[field]} onChange={(v) => set({ ...d, [field]: v })} error={errors[field]} />
      <CheckField label="Show on this resume" checked={d.show[k]} onChange={(v) => set({ ...d, show: { ...d.show, [k]: v } })} />
    </div>
  );
  return (
    <div className="space-y-4">
      <TextField label="Full name" required value={d.fullName} onChange={(v) => set({ ...d, fullName: v })} error={errors.fullName} />
      <div className="grid gap-4 sm:grid-cols-2">
        {show('headline', 'Headline', 'headline')}
        {show('location', 'Location', 'location')}
        {show('email', 'Email', 'email', 'email')}
        {show('phone', 'Phone', 'phone')}
      </div>
      <LinksEditor links={d.links} onChange={(links) => set({ ...d, links })} errors={errors} />
      <p className="text-xs text-muted">These edits apply to this resume only. Your profile is not changed.</p>
    </div>
  );
}

function ExperienceForm({ d, set, errors }: { d: ExperienceData; set: (d: ExperienceData) => void; errors: Errors }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Title" required value={d.title} onChange={(v) => set({ ...d, title: v })} error={errors.title} />
        <TextField label="Organization" required value={d.org} onChange={(v) => set({ ...d, org: v })} error={errors.org} />
        <TextField label="Location" value={d.location} onChange={(v) => set({ ...d, location: v })} error={errors.location} />
        <span />
        <MonthField label="Start" required value={d.start} onChange={(v) => set({ ...d, start: v })} error={errors.start} />
        <MonthField label="End" value={d.end} onChange={(v) => set({ ...d, end: v })} error={errors.end} hint="Empty means present." />
      </div>
      <TextArea label="Description" value={d.description} onChange={(v) => set({ ...d, description: v })} error={errors.description} />
      <BulletList mode="resume" bullets={d.bullets} onChange={(bullets) => set({ ...d, bullets: bullets.map((b) => ({ text: b.text, included: b.included !== false, verified: b.verified })) })} errors={errors} />
    </div>
  );
}

function ProjectForm({ d, set, errors }: { d: ProjectData; set: (d: ProjectData) => void; errors: Errors }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" required value={d.name} onChange={(v) => set({ ...d, name: v })} error={errors.name} className="sm:col-span-2" />
        <TextField label="Technology line" value={d.techLine} onChange={(v) => set({ ...d, techLine: v })} error={errors.techLine} hint="Printed as Tech Stack: ..." className="sm:col-span-2" />
        <TextField label="Year or period" value={d.yearLabel} onChange={(v) => set({ ...d, yearLabel: v })} error={errors.yearLabel} />
      </div>
      <TextArea label="Overview" rows={2} value={d.overview} onChange={(v) => set({ ...d, overview: v })} error={errors.overview} hint="Only printed when every bullet is hidden." />
      <LinksEditor links={d.links} onChange={(links) => set({ ...d, links })} errors={errors} />
      <BulletList mode="resume" bullets={d.bullets} onChange={(bullets) => set({ ...d, bullets: bullets.map((b) => ({ text: b.text, included: b.included !== false, verified: b.verified })) })} errors={errors} />
    </div>
  );
}

function EducationForm({ d, set, errors }: { d: EducationData; set: (d: EducationData) => void; errors: Errors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Degree" required value={d.degree} onChange={(v) => set({ ...d, degree: v })} error={errors.degree} />
      <TextField label="Field" value={d.field} onChange={(v) => set({ ...d, field: v })} error={errors.field} />
      <TextField label="Institution" required value={d.institution} onChange={(v) => set({ ...d, institution: v })} error={errors.institution} />
      <TextField label="Location" value={d.location} onChange={(v) => set({ ...d, location: v })} error={errors.location} />
      <TextField label="Grade" value={d.grade} onChange={(v) => set({ ...d, grade: v })} error={errors.grade} />
      <span />
      <MonthField label="Start" value={d.start} onChange={(v) => set({ ...d, start: v })} error={errors.start} />
      <MonthField label="End" value={d.end} onChange={(v) => set({ ...d, end: v })} error={errors.end} />
      <TextArea label="Details" value={d.details} onChange={(v) => set({ ...d, details: v })} error={errors.details} className="sm:col-span-2" />
    </div>
  );
}

export function ItemEditor({ item, onSave, onCancel }: { item: ResumeItem; onSave: (data: unknown) => Promise<void>; onCancel: () => void }) {
  const [draft, setDraft] = useState<unknown>(() => structuredClone(item.data));
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  async function save() {
    const schema = item.section === 'leadership' ? leadershipDataSchema : itemDataSchemas[item.section];
    const parsed = schema.safeParse(draft);
    if (!parsed.success) {
      setErrors(issuesToFields(parsed.error.issues));
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSave(parsed.data);
    } finally {
      setSaving(false);
    }
  }

  let body: React.ReactNode = null;
  switch (item.section) {
    case 'header':
      body = <HeaderForm d={draft as HeaderData} set={setDraft} errors={errors} />;
      break;
    case 'summary':
      body = <TextArea label="Summary" rows={5} value={(draft as SummaryData).text} onChange={(text) => setDraft({ text })} error={errors.text} hint="This is this resume's own copy. Your profile variant is not changed." />;
      break;
    case 'skills':
      body = (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Skill" required value={(draft as SkillData).name} onChange={(name) => setDraft({ ...(draft as SkillData), name })} error={errors.name} />
          <TextField label="Category" required value={(draft as SkillData).category} onChange={(category) => setDraft({ ...(draft as SkillData), category })} error={errors.category} />
        </div>
      );
      break;
    case 'experience':
    case 'leadership':
      body = <ExperienceForm d={draft as ExperienceData} set={setDraft} errors={errors} />;
      break;
    case 'projects':
      body = <ProjectForm d={draft as ProjectData} set={setDraft} errors={errors} />;
      break;
    case 'education':
      body = <EducationForm d={draft as EducationData} set={setDraft} errors={errors} />;
      break;
    case 'certifications': {
      const d = draft as CertificationData;
      body = (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Name" required value={d.name} onChange={(name) => setDraft({ ...d, name })} error={errors.name} className="sm:col-span-2" />
          <TextField label="Issuer" value={d.issuer} onChange={(issuer) => setDraft({ ...d, issuer })} error={errors.issuer} />
          <TextField label="Year" value={d.year} onChange={(year) => setDraft({ ...d, year })} error={errors.year} />
          <TextField label="Link" value={d.url} onChange={(url) => setDraft({ ...d, url })} error={errors.url} className="sm:col-span-2" />
        </div>
      );
      break;
    }
  }

  return (
    <div className="mt-3 border-t border-rule pt-3">
      {body}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" loading={saving} onClick={save}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
