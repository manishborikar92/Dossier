'use client';

import { useState } from 'react';
import { DEFAULT_SECTION_TITLES } from '@/lib/templates';
import type { ResumeItem, SectionKey, SourceType } from '@/lib/types';
import { Badge, Button, Dialog, TextField } from '../ui';
import type { BuilderLibrary } from './helpers';

export const SOURCE_FOR_SECTION: Record<SectionKey, Exclude<SourceType, 'profile'>> = {
  summary: 'summary',
  skills: 'skill',
  experience: 'experience',
  leadership: 'experience',
  projects: 'project',
  education: 'education',
  certifications: 'certification',
};

interface Option {
  id: number;
  title: string;
  meta: string;
  archived?: boolean;
}

/** The library items that can still be added to a section. */
function optionsFor(section: SectionKey, items: ResumeItem[], library: BuilderLibrary): Option[] {
  const sourceType = SOURCE_FOR_SECTION[section];
  const taken = new Set(items.filter((i) => i.sourceType === sourceType).map((i) => i.sourceId));
  switch (section) {
    case 'summary':
      return library.summaries.map((s) => ({ id: s.id, title: s.label, meta: s.text }));
    case 'skills':
      return library.skills.filter((s) => !taken.has(s.id)).map((s) => ({ id: s.id, title: s.name, meta: s.category }));
    case 'experience':
    case 'leadership': {
      const leadership = section === 'leadership';
      return library.experiences
        .filter((e) => (e.kind === 'leadership' || e.kind === 'volunteer') === leadership && !taken.has(e.id))
        .map((e) => ({ id: e.id, title: `${e.title} \u2014 ${e.org}`, meta: e.start, archived: e.archived }));
    }
    case 'projects':
      return library.projects
        .filter((p) => !taken.has(p.id))
        .map((p) => ({ id: p.id, title: p.name, meta: p.technologies.slice(0, 5).join(', '), archived: p.status === 'archived' }));
    case 'education':
      return library.education.filter((e) => !taken.has(e.id)).map((e) => ({ id: e.id, title: e.degree, meta: e.institution }));
    case 'certifications':
      return library.certifications.filter((c) => !taken.has(c.id)).map((c) => ({ id: c.id, title: c.name, meta: c.issuer }));
  }
}

interface Props {
  section: SectionKey | null;
  onClose: () => void;
  items: ResumeItem[];
  library: BuilderLibrary;
  onAdd: (sourceType: Exclude<SourceType, 'profile'>, sourceId: number) => Promise<void>;
}

export function AddFromLibraryDialog({ section, onClose, items, library, onAdd }: Props) {
  const [q, setQ] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const options = section ? optionsFor(section, items, library) : [];
  const needle = q.trim().toLowerCase();
  const shown = options.filter((o) => (showArchived || !o.archived) && (!needle || `${o.title} ${o.meta}`.toLowerCase().includes(needle)));
  const archivedCount = options.filter((o) => o.archived).length;
  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Dialog
      open={section !== null}
      onClose={close}
      title={section === 'summary' ? 'Choose a summary' : `Add to ${section ? DEFAULT_SECTION_TITLES[section].toLowerCase() : ''}`}
      description={
        section === 'summary'
          ? 'Choosing a summary replaces the one currently on this resume with a fresh copy.'
          : 'Pick items from your library. Each is copied into this resume.'
      }
      footer={<Button onClick={close}>Done</Button>}
    >
      <TextField label="Search" value={q} onChange={setQ} />
      {archivedCount > 0 ? (
        <label className="text-ink-2 mt-3 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="accent-brand" />
          Include archived or hidden items ({archivedCount})
        </label>
      ) : null}
      {shown.length === 0 ? (
        <p className="text-muted mt-4 text-sm">
          {options.length === 0
            ? 'Everything from your library is already on this resume, or the library has nothing for this section yet.'
            : 'No matches.'}
        </p>
      ) : (
        <ul className="divide-line border-line mt-4 divide-y rounded-lg border">
          {shown.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-ink truncate text-sm font-medium">
                  {o.title}
                  {o.archived ? (
                    <span className="ml-2">
                      <Badge tone="warn">Archived</Badge>
                    </span>
                  ) : null}
                </p>
                <p className="text-muted line-clamp-2 text-xs">{o.meta}</p>
              </div>
              <Button size="sm" onClick={() => section && void onAdd(SOURCE_FOR_SECTION[section], o.id)}>
                {section === 'summary' ? 'Use' : 'Add'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
