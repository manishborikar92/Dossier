'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
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
import { BulletList } from '../shared/BulletList';
import { Button, CheckField, IconButton, MonthField, TextArea, TextField } from '../ui';

type Errors = Record<string, string>;

function LinksEditor({ links, onChange, errors }: { links: ItemLink[]; onChange: (l: ItemLink[]) => void; errors: Errors }) {
  const update = (i: number, patch: Partial<ItemLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <fieldset>
      <legend className="text-ink-2 mb-2 text-[13px] font-medium">Links</legend>
      <div className="space-y-2">
        {links.map((l, i) => (
          <div key={i} className="grid items-start gap-3 sm:grid-cols-[auto_1fr_1.4fr_auto]">
            <input
              type="checkbox"
              aria-label={`Show link ${i + 1} on this resume`}
              checked={l.show}
              onChange={(e) => update(i, { show: e.target.checked })}
              className="accent-brand mt-3 size-4"
            />
            <TextField label="Text" value={l.label} onChange={(v) => update(i, { label: v })} error={errors[`links.${i}.label`]} />
            <TextField
              label="Address"
              value={l.url}
              placeholder="https://"
              onChange={(v) => update(i, { url: v })}
              error={errors[`links.${i}.url`]}
            />
            <IconButton
              label={`Remove link ${i + 1}`}
              icon={Trash2}
              tone="danger"
              className="sm:mt-7"
              onClick={() => onChange(links.filter((_, j) => j !== i))}
            />
          </div>
        ))}
      </div>
      <Button size="sm" className="mt-2" onClick={() => onChange([...links, { label: '', url: '', show: true }])}>
        <Plus className="size-4" aria-hidden />
        Add link
      </Button>
    </fieldset>
  );
}

function HeaderForm({ d, set, errors }: { d: HeaderData; set: (d: HeaderData) => void; errors: Errors }) {
  const shown = (key: keyof HeaderData['show'], label: string, type = 'text') => (
    <div className="space-y-1.5">
      <TextField label={label} type={type} value={d[key]} onChange={(v) => set({ ...d, [key]: v })} error={errors[key]} />
      <CheckField label="Show on this resume" checked={d.show[key]} onChange={(v) => set({ ...d, show: { ...d.show, [key]: v } })} />
    </div>
  );
  return (
    <div className="space-y-4">
      <TextField label="Full name" required value={d.fullName} onChange={(v) => set({ ...d, fullName: v })} error={errors.fullName} />
      <div className="grid gap-4 sm:grid-cols-2">
        {shown('headline', 'Headline')}
        {shown('location', 'Location')}
        {shown('email', 'Email', 'email')}
        {shown('phone', 'Phone')}
      </div>
      <LinksEditor links={d.links} onChange={(links) => set({ ...d, links })} errors={errors} />
      <p className="text-muted text-xs">These edits apply to this resume only. Your profile is not changed.</p>
    </div>
  );
}

function ExperienceForm({ d, set, errors }: { d: ExperienceData; set: (d: ExperienceData) => void; errors: Errors }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Title" required value={d.title} onChange={(v) => set({ ...d, title: v })} error={errors.title} />
        <TextField label="Organization" required value={d.org} onChange={(v) => set({ ...d, org: v })} error={errors.org} />
        <TextField
          label="Location"
          value={d.location}
          onChange={(v) => set({ ...d, location: v })}
          error={errors.location}
          className="sm:col-span-2"
        />
        <MonthField label="Start" required value={d.start} onChange={(v) => set({ ...d, start: v })} error={errors.start} />
        <MonthField label="End" value={d.end} onChange={(v) => set({ ...d, end: v })} error={errors.end} hint="Empty means present." />
      </div>
      <TextArea label="Description" value={d.description} onChange={(v) => set({ ...d, description: v })} error={errors.description} />
      <BulletList
        mode="resume"
        bullets={d.bullets}
        onChange={(bullets) =>
          set({ ...d, bullets: bullets.map((b) => ({ text: b.text, included: b.included !== false, verified: b.verified })) })
        }
        errors={errors}
      />
    </div>
  );
}

function ProjectForm({ d, set, errors }: { d: ProjectData; set: (d: ProjectData) => void; errors: Errors }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Name"
          required
          value={d.name}
          onChange={(v) => set({ ...d, name: v })}
          error={errors.name}
          className="sm:col-span-2"
        />
        <TextField
          label="Technology line"
          value={d.techLine}
          onChange={(v) => set({ ...d, techLine: v })}
          error={errors.techLine}
          hint="Printed as Tech Stack: ..."
          className="sm:col-span-2"
        />
        <TextField label="Year or period" value={d.yearLabel} onChange={(v) => set({ ...d, yearLabel: v })} error={errors.yearLabel} />
      </div>
      <TextArea
        label="Overview"
        rows={2}
        value={d.overview}
        onChange={(v) => set({ ...d, overview: v })}
        error={errors.overview}
        hint="Only printed when every bullet is hidden."
      />
      <LinksEditor links={d.links} onChange={(links) => set({ ...d, links })} errors={errors} />
      <BulletList
        mode="resume"
        bullets={d.bullets}
        onChange={(bullets) =>
          set({ ...d, bullets: bullets.map((b) => ({ text: b.text, included: b.included !== false, verified: b.verified })) })
        }
        errors={errors}
      />
    </div>
  );
}

function EducationForm({ d, set, errors }: { d: EducationData; set: (d: EducationData) => void; errors: Errors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Degree" required value={d.degree} onChange={(v) => set({ ...d, degree: v })} error={errors.degree} />
      <TextField label="Field" value={d.field} onChange={(v) => set({ ...d, field: v })} error={errors.field} />
      <TextField
        label="Institution"
        required
        value={d.institution}
        onChange={(v) => set({ ...d, institution: v })}
        error={errors.institution}
      />
      <TextField label="Location" value={d.location} onChange={(v) => set({ ...d, location: v })} error={errors.location} />
      <TextField label="Grade" value={d.grade} onChange={(v) => set({ ...d, grade: v })} error={errors.grade} className="sm:col-span-2" />
      <MonthField label="Start" value={d.start} onChange={(v) => set({ ...d, start: v })} error={errors.start} />
      <MonthField label="End" value={d.end} onChange={(v) => set({ ...d, end: v })} error={errors.end} />
      <TextArea
        label="Details"
        value={d.details}
        onChange={(v) => set({ ...d, details: v })}
        error={errors.details}
        className="sm:col-span-2"
      />
    </div>
  );
}

function CertificationForm({ d, set, errors }: { d: CertificationData; set: (d: CertificationData) => void; errors: Errors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Name"
        required
        value={d.name}
        onChange={(v) => set({ ...d, name: v })}
        error={errors.name}
        className="sm:col-span-2"
      />
      <TextField label="Issuer" value={d.issuer} onChange={(v) => set({ ...d, issuer: v })} error={errors.issuer} />
      <TextField label="Year" value={d.year} onChange={(v) => set({ ...d, year: v })} error={errors.year} />
      <TextField label="Link" value={d.url} onChange={(v) => set({ ...d, url: v })} error={errors.url} className="sm:col-span-2" />
    </div>
  );
}

function SkillForm({ d, set, errors }: { d: SkillData; set: (d: SkillData) => void; errors: Errors }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Skill" required value={d.name} onChange={(v) => set({ ...d, name: v })} error={errors.name} />
      <TextField label="Category" required value={d.category} onChange={(v) => set({ ...d, category: v })} error={errors.category} />
    </div>
  );
}

/** The editor for one resume item. Changes apply to this resume's copy only. */
export function ItemEditor({
  item,
  onSave,
  onCancel,
}: {
  item: ResumeItem;
  onSave: (data: unknown) => Promise<void>;
  onCancel: () => void;
}) {
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

  let body: ReactNode = null;
  switch (item.section) {
    case 'header':
      body = <HeaderForm d={draft as HeaderData} set={setDraft} errors={errors} />;
      break;
    case 'summary':
      body = (
        <TextArea
          label="Summary"
          rows={5}
          value={(draft as SummaryData).text}
          onChange={(text) => setDraft({ text })}
          error={errors.text}
          hint="This is this resume's own copy. Your profile variant is not changed."
        />
      );
      break;
    case 'skills':
      body = <SkillForm d={draft as SkillData} set={setDraft} errors={errors} />;
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
    case 'certifications':
      body = <CertificationForm d={draft as CertificationData} set={setDraft} errors={errors} />;
      break;
  }

  return (
    <div className="border-line bg-sunken rounded-b-lg border-t px-4 py-4">
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
