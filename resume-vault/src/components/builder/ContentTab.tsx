'use client';

import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import { DEFAULT_SECTION_TITLES } from '@/lib/templates';
import type { ResumeItem, ResumeRecord, SectionKey, SourceType, SyncStatus } from '@/lib/types';
import type { SyncDiff } from '@/server/resumes';
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, TextField, cx, useToast } from '../ui';
import { ItemEditor } from './ItemEditor';
import { itemMeta, itemTitle, unverifiedCount, type BuilderLibrary } from './helpers';

interface Props {
  resume: ResumeRecord;
  items: ResumeItem[];
  library: BuilderLibrary;
  /** Run an API call, report errors, then refresh the resume and preview. */
  mutate: (action: () => Promise<unknown>, successMessage?: string) => Promise<boolean>;
}

const SOURCE_FOR_SECTION: Partial<Record<SectionKey, SourceType>> = {
  summary: 'summary',
  skills: 'skill',
  experience: 'experience',
  leadership: 'experience',
  projects: 'project',
  education: 'education',
  certifications: 'certification',
};

export function ContentTab({ resume, items, library, mutate }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [adding, setAdding] = useState<SectionKey | null>(null);
  const [removing, setRemoving] = useState<ResumeItem | null>(null);
  const [reviewing, setReviewing] = useState<ResumeItem | null>(null);

  const header = items.find((i) => i.section === 'header');
  const ofSection = (key: SectionKey) => items.filter((i) => i.section === key).sort((a, b) => a.position - b.position);

  const move = (list: ResumeItem[], index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= list.length) return;
    const ids = list.map((i) => i.id);
    [ids[index], ids[j]] = [ids[j], ids[index]];
    void mutate(() => api(`/api/resumes/${resume.id}/items/reorder`, { body: { ids } }));
  };

  const card = (item: ResumeItem, list: ResumeItem[], index: number) => {
    const unverified = unverifiedCount(item);
    const editing = editingId === item.id;
    return (
      <li key={item.id} className={cx('rounded-lg border bg-surface p-3', item.included ? 'border-rule' : 'border-rule bg-paper')}>
        <div className="flex items-start gap-3">
          {item.section !== 'header' ? (
            <input
              type="checkbox"
              checked={item.included}
              aria-label={`Show ${itemTitle(item)} on this resume`}
              onChange={(e) => void mutate(() => api(`/api/resumes/${resume.id}/items/${item.id}`, { method: 'PATCH', body: { included: e.target.checked } }))}
              className="mt-1 h-4 w-4 shrink-0 accent-navy"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className={cx('text-sm font-medium', !item.included && 'text-muted line-through')}>{itemTitle(item)}</p>
            {itemMeta(item) ? <p className="truncate text-xs text-muted">{itemMeta(item)}</p> : null}
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <SyncBadge status={item.sync} onReview={() => setReviewing(item)} />
              {unverified > 0 ? <Badge tone="warn" title="Printed bullets not marked verified in your library">{unverified} unverified</Badge> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {item.section !== 'header' ? (
              <>
                <button type="button" aria-label={`Move ${itemTitle(item)} up`} disabled={index === 0} onClick={() => move(list, index, -1)} className="rounded p-1.5 text-muted hover:bg-navy-soft disabled:opacity-30">
                  <ArrowUp className="h-4 w-4" aria-hidden />
                </button>
                <button type="button" aria-label={`Move ${itemTitle(item)} down`} disabled={index === list.length - 1} onClick={() => move(list, index, 1)} className="rounded p-1.5 text-muted hover:bg-navy-soft disabled:opacity-30">
                  <ArrowDown className="h-4 w-4" aria-hidden />
                </button>
              </>
            ) : null}
            <Button size="sm" onClick={() => setEditingId(editing ? null : item.id)} aria-expanded={editing}>
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              {editing ? 'Close' : 'Edit'}
            </Button>
            {item.section !== 'header' ? (
              <button type="button" aria-label={`Remove ${itemTitle(item)} from this resume`} onClick={() => setRemoving(item)} className="rounded p-1.5 text-muted hover:bg-bad-bg hover:text-bad">
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
        {editing ? (
          <ItemEditor
            item={item}
            onCancel={() => setEditingId(null)}
            onSave={async (data) => {
              const ok = await mutate(() => api(`/api/resumes/${resume.id}/items/${item.id}`, { method: 'PATCH', body: { data } }), 'Changes saved to this resume.');
              if (ok) setEditingId(null);
            }}
          />
        ) : null}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      {resume.status === 'final' ? (
        <p className="rounded-md bg-navy-soft p-3 text-sm">
          This resume is marked <strong>final</strong>. Edits here are not part of your saved versions until you save a new version.
        </p>
      ) : null}
      <p className="text-sm text-muted">
        Everything here is this resume&apos;s own copy. Editing it never changes your library or your other resumes. Untick an item to hide it without losing your edits.
      </p>

      {header ? <ul>{card(header, [header], 0)}</ul> : null}

      {resume.settings.sectionOrder.map((key) => {
        const list = ofSection(key);
        const hidden = resume.settings.hiddenSections.includes(key);
        const title = resume.settings.sectionTitles[key]?.trim() || DEFAULT_SECTION_TITLES[key];
        return (
          <section key={key} aria-labelledby={`sec-${key}`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 id={`sec-${key}`} className="font-serif text-base font-semibold">
                {title}
                <span className="ml-2 text-sm font-normal text-muted">{list.filter((i) => i.included).length} shown</span>
                {hidden ? <span className="ml-2 align-middle"><Badge tone="warn">Section hidden</Badge></span> : null}
              </h3>
              <Button size="sm" onClick={() => setAdding(key)}>
                <Plus className="h-4 w-4" aria-hidden />
                {key === 'summary' ? 'Choose summary' : 'Add from library'}
              </Button>
            </div>
            {hidden ? <p className="mb-2 text-xs text-muted">This section is hidden. Show it again in the Setup tab.</p> : null}
            {list.length === 0 ? (
              <EmptyState title={`Nothing in ${title.toLowerCase()} yet`}>Use Add from library to bring something in.</EmptyState>
            ) : (
              <ul className="space-y-2">{list.map((item, i) => card(item, list, i))}</ul>
            )}
          </section>
        );
      })}

      <AddDialog section={adding} onClose={() => setAdding(null)} items={items} library={library} onAdd={async (sourceType, sourceId) => {
        const ok = await mutate(() => api(`/api/resumes/${resume.id}/items`, { body: { sourceType, sourceId } }), 'Added to this resume.');
        if (ok && adding !== 'summary') return;
        if (ok) setAdding(null);
      }} />

      <ConfirmDialog
        open={removing !== null}
        title="Remove from this resume?"
        confirmLabel="Remove"
        danger
        onConfirm={async () => {
          if (!removing) return;
          const target = removing;
          setRemoving(null);
          await mutate(() => api(`/api/resumes/${resume.id}/items/${target.id}`, { method: 'DELETE' }), 'Removed from this resume.');
        }}
        onCancel={() => setRemoving(null)}
      >
        <p>
          <strong>{removing ? itemTitle(removing) : ''}</strong> will be removed from this resume only. Your library is not changed, and you can add it again, but any edits you made on this resume would be lost. To keep your edits, untick it to hide it instead.
        </p>
      </ConfirmDialog>

      <ReviewDialog resumeId={resume.id} item={reviewing} onClose={() => setReviewing(null)} mutate={mutate} />
    </div>
  );
}

function SyncBadge({ status, onReview }: { status: SyncStatus; onReview: () => void }) {
  if (status === 'changed') {
    return (
      <button type="button" onClick={onReview} className="inline-flex items-center gap-1 rounded bg-warn-bg px-1.5 py-0.5 text-xs font-medium text-warn hover:underline">
        <RefreshCw className="h-3 w-3" aria-hidden />
        Library changed. Review
      </button>
    );
  }
  if (status === 'missing') return <Badge title="The library entry this was copied from has been deleted. This resume keeps its own copy.">Deleted from library</Badge>;
  return null;
}

/* ---------- add from library ---------- */

function AddDialog({ section, onClose, items, library, onAdd }: { section: SectionKey | null; onClose: () => void; items: ResumeItem[]; library: BuilderLibrary; onAdd: (type: SourceType, id: number) => Promise<void> }) {
  const [q, setQ] = useState('');
  const [archived, setArchived] = useState(false);
  const sourceType = section ? SOURCE_FOR_SECTION[section] : undefined;

  type Option = { id: number; title: string; meta: string; archived?: boolean };
  let options: Option[] = [];
  if (section && sourceType) {
    const taken = new Set(items.filter((i) => i.sourceType === sourceType).map((i) => i.sourceId));
    if (section === 'summary') options = library.summaries.map((s) => ({ id: s.id, title: s.label, meta: s.text }));
    if (section === 'skills') options = library.skills.filter((s) => !taken.has(s.id)).map((s) => ({ id: s.id, title: s.name, meta: s.category }));
    if (section === 'experience' || section === 'leadership') {
      const leadership = section === 'leadership';
      options = library.experiences
        .filter((e) => (e.kind === 'leadership' || e.kind === 'volunteer') === leadership && !taken.has(e.id))
        .map((e) => ({ id: e.id, title: `${e.title} \u2014 ${e.org}`, meta: e.start, archived: e.archived }));
    }
    if (section === 'projects') options = library.projects.filter((p) => !taken.has(p.id)).map((p) => ({ id: p.id, title: p.name, meta: p.technologies.slice(0, 5).join(', '), archived: p.status === 'archived' }));
    if (section === 'education') options = library.education.filter((e) => !taken.has(e.id)).map((e) => ({ id: e.id, title: e.degree, meta: e.institution }));
    if (section === 'certifications') options = library.certifications.filter((c) => !taken.has(c.id)).map((c) => ({ id: c.id, title: c.name, meta: c.issuer }));
  }
  const needle = q.trim().toLowerCase();
  const shown = options.filter((o) => (archived || !o.archived) && (!needle || `${o.title} ${o.meta}`.toLowerCase().includes(needle)));
  const hiddenArchived = options.filter((o) => o.archived).length;

  return (
    <Dialog open={section !== null} onClose={() => { setQ(''); onClose(); }} title={section === 'summary' ? 'Choose a summary' : `Add to ${section ? DEFAULT_SECTION_TITLES[section].toLowerCase() : ''}`} footer={<Button onClick={() => { setQ(''); onClose(); }}>Done</Button>}>
      <TextField label="Search" value={q} onChange={setQ} />
      {section === 'summary' ? <p className="mt-2 text-sm text-muted">Choosing a summary replaces the one currently on this resume with a fresh copy.</p> : null}
      {hiddenArchived > 0 ? (
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} className="accent-navy" />
          Include archived or hidden items ({hiddenArchived})
        </label>
      ) : null}
      {shown.length === 0 ? (
        <p className="mt-4 text-sm text-muted">{options.length === 0 ? 'Everything from your library is already on this resume, or the library has nothing for this section yet.' : 'No matches.'}</p>
      ) : (
        <ul className="mt-3 divide-y divide-rule rounded-md border border-rule">
          {shown.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{o.title}{o.archived ? <span className="ml-2"><Badge tone="warn">Archived</Badge></span> : null}</p>
                <p className="line-clamp-2 text-xs text-muted">{o.meta}</p>
              </div>
              <Button size="sm" onClick={() => sourceType && void onAdd(sourceType, o.id)}>
                {section === 'summary' ? 'Use' : 'Add'}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

/* ---------- review a changed library item ---------- */

function ReviewDialog({ resumeId, item, onClose, mutate }: { resumeId: number; item: ResumeItem | null; onClose: () => void; mutate: Props['mutate'] }) {
  const toast = useToast();
  const [state, setState] = useState<{ key: number; diff: SyncDiff | null; error: string | null }>({ key: 0, diff: null, error: null });
  const itemId = item?.id ?? null;

  // Load the comparison whenever a different item is opened.
  useEffect(() => {
    if (itemId === null) return;
    let cancelled = false;
    api<SyncDiff>(`/api/resumes/${resumeId}/items/${itemId}/sync`)
      .then((diff) => {
        if (!cancelled) setState({ key: itemId, diff, error: null });
      })
      .catch((e) => {
        if (!cancelled) setState({ key: itemId, diff: null, error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [resumeId, itemId]);

  const diff = item && state.key === item.id ? state.diff : null;
  const error = item && state.key === item.id ? state.error : null;
  const mine = diff?.mine ?? [];
  const lib = diff?.library ?? [];

  const act = async (action: 'pull' | 'keep') => {
    if (!item) return;
    const ok = await mutate(() => api(`/api/resumes/${resumeId}/items/${item.id}/sync`, { body: { action } }), action === 'pull' ? 'This resume now has the latest library version.' : 'Kept your version.');
    if (ok) onClose();
    else toast.error('Could not update this item.');
  };

  const column = (title: string, lines: string[], other: string[]) => (
    <div>
      <h3 className="mb-1 text-sm font-semibold">{title}</h3>
      <ul className="space-y-1 rounded-md border border-rule bg-paper p-2 text-[13px]">
        {lines.length === 0 ? <li className="text-muted">Nothing</li> : null}
        {lines.map((l, i) => (
          <li key={i} className={cx('rounded px-1 py-0.5 break-words', !other.includes(l) && 'bg-warn-bg')}>
            {l}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <Dialog
      open={item !== null}
      onClose={onClose}
      wide
      title="Your library has changed"
      footer={
        <>
          <Button onClick={onClose}>Decide later</Button>
          <Button onClick={() => act('keep')}>Keep my version</Button>
          <Button variant="primary" onClick={() => act('pull')}>Use the library version</Button>
        </>
      }
    >
      {error ? <p role="alert" className="text-sm font-medium text-bad">{error}</p> : null}
      {!diff && !error ? <p className="text-sm text-muted">Loading the comparison…</p> : null}
      {diff ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Highlighted lines differ. <strong>Use the library version</strong> replaces this resume&apos;s copy, including any edits and hidden bullets on it. <strong>Keep my version</strong> leaves it exactly as it is and stops the reminder.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {column('This resume now', mine, lib)}
            {column('Library now', lib, mine)}
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
