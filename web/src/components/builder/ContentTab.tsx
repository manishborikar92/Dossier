'use client';

import { ChevronDown, Plus, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cx } from '@/lib/classes';
import { DEFAULT_SECTION_TITLES } from '@/lib/templates';
import type { ResumeItem, ResumeRecord, SectionKey, SkillData } from '@/lib/types';
import { Badge, Button, ConfirmDialog, Notice } from '../ui';
import { AddFromLibraryDialog } from './AddFromLibraryDialog';
import { ItemRow } from './ItemRow';
import { ReviewChangeDialog } from './ReviewChangeDialog';
import { itemTitle, type BuilderLibrary } from './helpers';
import type { Mutate } from './types';

interface Props {
  resume: ResumeRecord;
  items: ResumeItem[];
  library: BuilderLibrary;
  mutate: Mutate;
}

/** Sections with many small items (like skills) start collapsed so the page stays short. */
const startsOpen = (key: SectionKey, count: number): boolean => key !== 'skills' || count <= 10;

export function ContentTab({ resume, items, library, mutate }: Props) {
  const [adding, setAdding] = useState<SectionKey | null>(null);
  const [removing, setRemoving] = useState<ResumeItem | null>(null);
  const [reviewing, setReviewing] = useState<ResumeItem | null>(null);
  const [open, setOpen] = useState<Partial<Record<SectionKey, boolean>>>({});

  const header = items.find((i) => i.section === 'header');
  const ofSection = (key: SectionKey) => items.filter((i) => i.section === key).sort((a, b) => a.position - b.position);
  const changedItems = items.filter((i) => i.sync === 'changed');

  const move = (list: ResumeItem[], index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const ids = list.map((i) => i.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void mutate(() => api.resumes.reorderItems(resume.id, ids));
  };

  const row = (item: ResumeItem, list: ResumeItem[], index: number, compact = false) => (
    <ItemRow
      key={item.id}
      item={item}
      resumeId={resume.id}
      index={index}
      count={list.length}
      compact={compact}
      mutate={mutate}
      onMove={(i, dir) => move(list, i, dir)}
      onRemove={setRemoving}
      onReview={setReviewing}
    />
  );

  const renderItems = (key: SectionKey, list: ResumeItem[]) => {
    if (key !== 'skills') return <ul className="space-y-2">{list.map((item, i) => row(item, list, i))}</ul>;
    // Skills are shown grouped by category, in compact rows.
    const categories = [...new Set(list.map((i) => (i.data as SkillData).category))];
    return (
      <div className="space-y-4">
        {categories.map((category) => (
          <div key={category}>
            <h4 className="text-muted mb-1.5 text-[11px] font-semibold tracking-wider uppercase">{category}</h4>
            <ul className="space-y-1.5">
              {list.map((item, i) => ((item.data as SkillData).category === category ? row(item, list, i, true) : null))}
            </ul>
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="space-y-5">
        {resume.status === 'final' ? (
          <Notice tone="info">
            This resume is marked <strong>final</strong>. Edits here are not part of your saved versions until you save a new version.
          </Notice>
        ) : null}

        {changedItems.length > 0 ? (
          <div className="border border-warn/30 bg-warn-soft/40 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              <RefreshCw className="size-5 text-warn shrink-0 mt-0.5" aria-hidden />
              <div>
                <p className="text-ink text-sm font-semibold">
                  {changedItems.length} {changedItems.length === 1 ? 'item has' : 'items have'} changed in your library
                </p>
                <p className="text-muted text-xs mt-0.5">
                  Your library was updated since these items were added to this resume. Review each change to use the library version or
                  keep this resume&apos;s version.
                </p>
              </div>
            </div>
            <Button size="sm" variant="primary" onClick={() => setReviewing(changedItems[0])} className="shrink-0">
              Review changes ({changedItems.length})
            </Button>
          </div>
        ) : null}
        <p className="text-muted text-sm">
          Everything here is this resume&apos;s own copy. Editing it never changes your library or your other resumes. Untick an item to
          hide it without losing your edits.
        </p>

        {header ? <ul>{row(header, [header], 0)}</ul> : null}

        {resume.settings.sectionOrder.map((key) => {
          const list = ofSection(key);
          const hidden = resume.settings.hiddenSections.includes(key);
          const title = resume.settings.sectionTitles[key]?.trim() || DEFAULT_SECTION_TITLES[key];
          const shown = list.filter((i) => i.included).length;
          const isOpen = open[key] ?? startsOpen(key, list.length);
          const panelId = `section-panel-${key}`;
          return (
            <section key={key} aria-label={title} className="border-line bg-surface shadow-card rounded-xl border">
              <div className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen((o) => ({ ...o, [key]: !isOpen }))}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <ChevronDown className={cx('text-muted size-4 shrink-0 transition-transform', !isOpen && '-rotate-90')} aria-hidden />
                  <h3 className="text-ink text-sm leading-snug font-semibold tracking-tight">{title}</h3>
                  <span className="text-muted hidden shrink-0 text-xs min-[460px]:inline">
                    {shown} of {list.length} shown
                  </span>
                  {hidden ? <Badge tone="warn">Section hidden</Badge> : null}
                </button>
                <Button size="sm" onClick={() => setAdding(key)}>
                  <Plus className="size-3.5" aria-hidden />
                  {key === 'summary' ? (
                    'Choose'
                  ) : (
                    <>
                      <span className="hidden sm:inline">Add from library</span>
                      <span className="sm:hidden">Add</span>
                    </>
                  )}
                </Button>
              </div>
              {isOpen ? (
                <div id={panelId} className="border-line border-t px-4 py-3">
                  {hidden ? (
                    <p className="text-muted mb-2 text-xs">This section is hidden on the resume. Show it again in the Setup tab.</p>
                  ) : null}
                  {list.length === 0 ? (
                    <p className="text-muted py-2 text-sm">
                      Nothing here yet. Use “{key === 'summary' ? 'Choose summary' : 'Add from library'}” to bring something in.
                    </p>
                  ) : (
                    renderItems(key, list)
                  )}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <AddFromLibraryDialog
        section={adding}
        onClose={() => setAdding(null)}
        items={items}
        library={library}
        onAdd={async (sourceType, sourceId) => {
          const ok = await mutate(() => api.resumes.addItem(resume.id, { sourceType, sourceId }), 'Added to this resume.');
          if (ok && adding === 'summary') setAdding(null);
        }}
      />

      <ConfirmDialog
        open={removing !== null}
        title="Remove from this resume?"
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (!removing) return;
          const target = removing;
          setRemoving(null);
          await mutate(() => api.resumes.removeItem(resume.id, target.id), 'Removed from this resume.');
        }}
        onCancel={() => setRemoving(null)}
      >
        <p>
          <strong>{removing ? itemTitle(removing) : ''}</strong> will be removed from this resume only. Your library is not changed, and you
          can add it again, but any edits you made on this resume would be lost. To keep your edits, untick it to hide it instead.
        </p>
      </ConfirmDialog>

      <ReviewChangeDialog resumeId={resume.id} item={reviewing} onClose={() => setReviewing(null)} mutate={mutate} />
    </>
  );
}
