'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { api } from '@/lib/client';
import { TEMPLATE_IDS } from '@/lib/schemas';
import { ACCENT_PRESETS, DEFAULT_SECTION_TITLES, TEMPLATES } from '@/lib/templates';
import type { ResumeRecord, ResumeSettings, SectionKey } from '@/lib/types';
import { Button, SelectField, TextField, cx } from '../ui';

interface Props {
  resume: ResumeRecord;
  mutate: (action: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
}

export function SetupTab({ resume, mutate }: Props) {
  const [name, setName] = useState(resume.name);
  const [targetTitle, setTargetTitle] = useState(resume.targetTitle);
  const [targetCompany, setTargetCompany] = useState(resume.targetCompany);
  const [accent, setAccent] = useState(resume.settings.accent);
  const [titles, setTitles] = useState<Record<string, string>>(resume.settings.sectionTitles);
  const [nameError, setNameError] = useState('');
  const s = resume.settings;

  const patch = (body: Record<string, unknown>, message?: string) => mutate(() => api(`/api/resumes/${resume.id}`, { method: 'PATCH', body }), message);
  const patchSettings = (settings: Partial<ResumeSettings>, message?: string) => patch({ settings }, message);

  const moveSection = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= s.sectionOrder.length) return;
    const order = [...s.sectionOrder];
    [order[index], order[j]] = [order[j], order[index]];
    void patchSettings({ sectionOrder: order });
  };
  const toggleSection = (key: SectionKey, visible: boolean) =>
    void patchSettings({ hiddenSections: visible ? s.hiddenSections.filter((k) => k !== key) : [...s.hiddenSections, key] });

  const validHex = /^#[0-9a-fA-F]{6}$/.test(accent);

  return (
    <div className="space-y-8">
      <section aria-labelledby="s-details">
        <h3 id="s-details" className="mb-2 font-serif text-base font-semibold">Details</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Resume name" required value={name} onChange={(v) => { setName(v); setNameError(''); }} error={nameError} className="sm:col-span-2" />
          <TextField label="Target job title" value={targetTitle} onChange={setTargetTitle} />
          <TextField label="Target company" value={targetCompany} onChange={setTargetCompany} />
          <SelectField label="Status" value={resume.status} onChange={(v) => void patch({ status: v }, v === 'final' ? 'Marked as final.' : 'Marked as draft.')} options={[{ value: 'draft', label: 'Draft' }, { value: 'final', label: 'Final' }]} hint="A label for you. Saved versions are what protect a resume you have sent." />
        </div>
        <Button
          className="mt-3"
          variant="primary"
          onClick={() => {
            if (name.trim() === '') return setNameError('Resume name is required');
            void patch({ name, targetTitle, targetCompany }, 'Details saved.');
          }}
        >
          Save details
        </Button>
      </section>

      <section aria-labelledby="s-template">
        <h3 id="s-template" className="mb-2 font-serif text-base font-semibold">Template</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          {TEMPLATE_IDS.map((id) => (
            <label key={id} className={cx('cursor-pointer rounded-md border p-2.5 text-sm', resume.template === id ? 'border-navy bg-navy-soft' : 'border-rule bg-surface')}>
              <input type="radio" name="template" checked={resume.template === id} onChange={() => void patch({ template: id })} className="mr-2 accent-navy" />
              <span className="font-medium">{TEMPLATES[id].label}</span>
              <span className="mt-1 block text-xs text-muted">{TEMPLATES[id].description}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">All templates are single-column, use standard section headings and real text, which is what applicant tracking systems read best.</p>
      </section>

      <section aria-labelledby="s-look">
        <h3 id="s-look" className="mb-2 font-serif text-base font-semibold">Look and page</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Page size" value={s.pageSize} onChange={(v) => void patchSettings({ pageSize: v as ResumeSettings['pageSize'] })} options={[{ value: 'A4', label: 'A4' }, { value: 'LETTER', label: 'US Letter' }]} />
          <SelectField label="Spacing" value={s.density} onChange={(v) => void patchSettings({ density: v as ResumeSettings['density'] })} options={[{ value: 'compact', label: 'Compact' }, { value: 'normal', label: 'Normal' }, { value: 'relaxed', label: 'Relaxed' }]} hint="Tighten it to fit on one page." />
        </div>
        <fieldset className="mt-4">
          <legend className="mb-1 text-sm font-medium">Accent colour</legend>
          <div className="flex flex-wrap items-center gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={s.accent.toLowerCase() === p.value.toLowerCase()}
                onClick={() => { setAccent(p.value); void patchSettings({ accent: p.value }); }}
                className={cx('flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm', s.accent.toLowerCase() === p.value.toLowerCase() ? 'border-navy bg-navy-soft' : 'border-rule bg-surface')}
              >
                <span className="h-3.5 w-3.5 rounded-full border border-rule" style={{ background: p.value }} aria-hidden />
                {p.label}
              </button>
            ))}
            <TextField label="Custom" value={accent} onChange={setAccent} className="w-32" error={validHex ? undefined : 'Use #RRGGBB'} />
            <Button size="sm" disabled={!validHex || accent.toLowerCase() === s.accent.toLowerCase()} onClick={() => void patchSettings({ accent })}>Apply</Button>
          </div>
        </fieldset>
      </section>

      <section aria-labelledby="s-sections">
        <h3 id="s-sections" className="mb-1 font-serif text-base font-semibold">Sections</h3>
        <p className="mb-2 text-sm text-muted">Choose which sections appear, their order, the heading printed for each, and whether a section starts on a new page. Empty sections never print. Short entries are never split across two pages.</p>
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
          {s.sectionOrder.map((key, i) => (
            <li key={key} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <input type="checkbox" aria-label={`Show the ${DEFAULT_SECTION_TITLES[key]} section`} checked={!s.hiddenSections.includes(key)} onChange={(e) => toggleSection(key, e.target.checked)} className="h-4 w-4 accent-navy" />
              <div className="min-w-[10rem] flex-1">
                <input
                  aria-label={`Heading for ${DEFAULT_SECTION_TITLES[key]}`}
                  value={titles[key] ?? ''}
                  placeholder={DEFAULT_SECTION_TITLES[key]}
                  onChange={(e) => setTitles({ ...titles, [key]: e.target.value })}
                  onBlur={() => { if ((titles[key] ?? '') !== (s.sectionTitles[key] ?? '')) void patchSettings({ sectionTitles: { ...s.sectionTitles, [key]: titles[key] ?? '' } }); }}
                  className="w-full rounded border border-rule px-2 py-1 text-sm"
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={s.pageBreakBefore.includes(key)}
                  onChange={(e) => void patchSettings({ pageBreakBefore: e.target.checked ? [...s.pageBreakBefore, key] : s.pageBreakBefore.filter((k) => k !== key) })}
                  className="h-3.5 w-3.5 accent-navy"
                />
                Start on a new page
              </label>
              <div className="flex">
                <button type="button" aria-label={`Move ${DEFAULT_SECTION_TITLES[key]} up`} disabled={i === 0} onClick={() => moveSection(i, -1)} className="rounded p-1.5 text-muted hover:bg-navy-soft disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" aria-label={`Move ${DEFAULT_SECTION_TITLES[key]} down`} disabled={i === s.sectionOrder.length - 1} onClick={() => moveSection(i, 1)} className="rounded p-1.5 text-muted hover:bg-navy-soft disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
