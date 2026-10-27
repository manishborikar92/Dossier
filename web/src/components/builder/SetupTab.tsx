'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { cx } from '@/lib/classes';
import { ACCENT_PRESETS, DEFAULT_SECTION_TITLES } from '@/lib/templates';
import type { ResumeRecord, ResumeSettings, SectionKey } from '@/lib/types';
import { TemplatePicker } from '../resumes/TemplatePicker';
import { Button, IconButton, SelectField, TextField } from '../ui';
import type { Mutate } from './types';

function Group({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-line bg-surface shadow-card rounded-xl border p-5">
      <h3 id={id} className="text-ink text-sm font-semibold tracking-tight">
        {title}
      </h3>
      {description ? <p className="text-muted mt-0.5 mb-3 text-sm">{description}</p> : <div className="mb-3" />}
      {children}
    </section>
  );
}

export function SetupTab({ resume, mutate }: { resume: ResumeRecord; mutate: Mutate }) {
  const [name, setName] = useState(resume.name);
  const [targetTitle, setTargetTitle] = useState(resume.targetTitle);
  const [targetCompany, setTargetCompany] = useState(resume.targetCompany);
  const [accent, setAccent] = useState(resume.settings.accent);
  const [titles, setTitles] = useState<Record<string, string>>(resume.settings.sectionTitles);
  const [nameError, setNameError] = useState('');
  const s = resume.settings;

  const patch = (body: Parameters<typeof api.resumes.update>[1], message?: string) =>
    mutate(() => api.resumes.update(resume.id, body), message);
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
  const toggleBreak = (key: SectionKey, on: boolean) =>
    void patchSettings({ pageBreakBefore: on ? [...s.pageBreakBefore, key] : s.pageBreakBefore.filter((k) => k !== key) });

  const validHex = /^#[0-9a-fA-F]{6}$/.test(accent);
  const isCurrentAccent = (value: string) => s.accent.toLowerCase() === value.toLowerCase();

  return (
    <div className="space-y-5">
      <Group id="s-details" title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Resume name"
            required
            value={name}
            onChange={(v) => {
              setName(v);
              setNameError('');
            }}
            error={nameError}
            className="sm:col-span-2"
          />
          <TextField label="Target job title" value={targetTitle} onChange={setTargetTitle} />
          <TextField label="Target company" value={targetCompany} onChange={setTargetCompany} />
          <SelectField
            label="Status"
            value={resume.status}
            onChange={(v) => void patch({ status: v as ResumeRecord['status'] }, v === 'final' ? 'Marked as final.' : 'Marked as draft.')}
            options={[
              { value: 'draft', label: 'Draft' },
              { value: 'final', label: 'Final' },
            ]}
            hint="A label for you. Saved versions are what protect a resume you have sent."
          />
        </div>
        <Button
          className="mt-4"
          variant="primary"
          onClick={() => {
            if (name.trim() === '') return setNameError('Resume name is required');
            void patch({ name, targetTitle, targetCompany }, 'Details saved.');
          }}
        >
          Save details
        </Button>
      </Group>

      <Group
        id="s-template"
        title="Template"
        description="All templates are single-column with standard section headings and real text, which is what applicant tracking systems read best."
      >
        <TemplatePicker value={resume.template} onChange={(template) => void patch({ template })} name="builder-template" />
      </Group>

      <Group id="s-look" title="Look and page">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Page size"
            value={s.pageSize}
            onChange={(v) => void patchSettings({ pageSize: v as ResumeSettings['pageSize'] })}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'LETTER', label: 'US Letter' },
            ]}
          />
          <SelectField
            label="Spacing"
            value={s.density}
            onChange={(v) => void patchSettings({ density: v as ResumeSettings['density'] })}
            options={[
              { value: 'compact', label: 'Compact' },
              { value: 'normal', label: 'Normal' },
              { value: 'relaxed', label: 'Relaxed' },
            ]}
            hint="Tighten it to fit on one page."
          />
        </div>
        <fieldset className="mt-5">
          <legend className="text-ink-2 mb-2 text-[13px] font-medium">Accent colour</legend>
          <div className="flex flex-wrap items-end gap-2">
            {ACCENT_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={isCurrentAccent(p.value)}
                onClick={() => {
                  setAccent(p.value);
                  void patchSettings({ accent: p.value });
                }}
                className={cx(
                  'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm',
                  isCurrentAccent(p.value)
                    ? 'border-brand bg-brand-soft ring-brand/20 ring-2'
                    : 'border-line-strong bg-surface hover:bg-sunken',
                )}
              >
                <span className="border-line size-4 rounded-full border" style={{ background: p.value }} aria-hidden />
                {p.label}
              </button>
            ))}
            <TextField label="Custom" value={accent} onChange={setAccent} className="w-32" error={validHex ? undefined : 'Use #RRGGBB'} />
            <Button disabled={!validHex || isCurrentAccent(accent)} onClick={() => void patchSettings({ accent })}>
              Apply
            </Button>
          </div>
        </fieldset>
      </Group>

      <Group
        id="s-sections"
        title="Sections"
        description="Choose which sections appear, their order, the heading printed for each, and whether a section starts on a new page. Empty sections never print. Short entries are never split across two pages."
      >
        <ul className="divide-line border-line divide-y rounded-lg border">
          {s.sectionOrder.map((key, i) => (
            <li key={key} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
              <input
                type="checkbox"
                aria-label={`Show the ${DEFAULT_SECTION_TITLES[key]} section`}
                checked={!s.hiddenSections.includes(key)}
                onChange={(e) => toggleSection(key, e.target.checked)}
                className="accent-brand size-4"
              />
              <input
                aria-label={`Heading for ${DEFAULT_SECTION_TITLES[key]}`}
                value={titles[key] ?? ''}
                placeholder={DEFAULT_SECTION_TITLES[key]}
                onChange={(e) => setTitles({ ...titles, [key]: e.target.value })}
                onBlur={() => {
                  if ((titles[key] ?? '') !== (s.sectionTitles[key] ?? ''))
                    void patchSettings({ sectionTitles: { ...s.sectionTitles, [key]: titles[key] ?? '' } });
                }}
                className="border-line-strong focus:border-brand focus:ring-brand/15 min-w-40 flex-1 rounded-lg border px-2.5 py-1.5 text-sm focus:ring-[3px] focus:outline-none"
              />
              <label className="text-muted flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={s.pageBreakBefore.includes(key)}
                  onChange={(e) => toggleBreak(key, e.target.checked)}
                  className="accent-brand size-3.5"
                />
                Start on a new page
              </label>
              <div className="flex">
                <IconButton
                  label={`Move ${DEFAULT_SECTION_TITLES[key]} up`}
                  icon={ArrowUp}
                  disabled={i === 0}
                  onClick={() => moveSection(i, -1)}
                />
                <IconButton
                  label={`Move ${DEFAULT_SECTION_TITLES[key]} down`}
                  icon={ArrowDown}
                  disabled={i === s.sectionOrder.length - 1}
                  onClick={() => moveSection(i, 1)}
                />
              </div>
            </li>
          ))}
        </ul>
      </Group>
    </div>
  );
}
