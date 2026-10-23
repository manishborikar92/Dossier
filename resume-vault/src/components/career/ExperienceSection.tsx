'use client';

import { Briefcase } from 'lucide-react';
import { Badge, Button, CheckField, EmptyState, MonthField, SelectField, TextArea, TextField } from '../ui';
import { formatRange } from '@/lib/format';
import { EXPERIENCE_KINDS, experienceSchema } from '@/lib/schemas';
import type { Experience } from '@/lib/types';
import { BulletList, type EditableBullet } from '../shared/BulletList';
import { useDeleter, useEntityEditor, useEntityList } from './hooks';
import { FormDialog, RowActions, TabIntro, usedBadge } from './parts';

interface Draft {
  org: string;
  title: string;
  location: string;
  start: string;
  end: string;
  kind: (typeof EXPERIENCE_KINDS)[number];
  description: string;
  archived: boolean;
  bullets: EditableBullet[];
}

const BLANK: Draft = { org: '', title: '', location: '', start: '', end: '', kind: 'job', description: '', archived: false, bullets: [] };
const KIND_LABEL: Record<Draft['kind'], string> = {
  job: 'Job',
  internship: 'Internship',
  freelance: 'Freelance',
  leadership: 'Leadership',
  volunteer: 'Volunteer',
};

const toDraft = (e: Experience): Draft => ({
  org: e.org,
  title: e.title,
  location: e.location,
  start: e.start,
  end: e.end,
  kind: e.kind,
  description: e.description,
  archived: e.archived,
  bullets: e.bullets.map((b) => ({ id: b.id, text: b.text, verified: b.verified })),
});

export function ExperienceSection({ initial }: { initial: Experience[] }) {
  const list = useEntityList('experiences', initial);
  const editor = useEntityEditor<'experiences', Draft>('experiences', experienceSchema, list.reload, 'Experience saved.');
  const del = useDeleter('experiences', list.reload, 'Experience');
  const d = editor.editing?.draft;
  const isLeadership = d?.kind === 'leadership' || d?.kind === 'volunteer';

  return (
    <section aria-label="Experience">
      <TabIntro addLabel="Add experience" onAdd={() => editor.open(BLANK)}>
        Jobs, internships, freelance work and leadership roles. Leadership and volunteer entries get their own section on a resume.
      </TabIntro>

      {list.items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No experience yet"
          action={
            <Button variant="primary" onClick={() => editor.open(BLANK)}>
              Add your first role
            </Button>
          }
        >
          Add each role once, with the achievements you can stand behind. Resumes pick from them.
        </EmptyState>
      ) : (
        <ul className="divide-line border-line bg-surface shadow-card divide-y rounded-xl border">
          {list.items.map((e, i) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4">
              <div className="min-w-0">
                <p className="text-ink font-medium">
                  {e.title} <span className="text-muted font-normal">at {e.org}</span>
                </p>
                <p className="text-muted text-sm">{formatRange(e.start, e.end)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge tone="brand">{KIND_LABEL[e.kind]}</Badge>
                  {e.bullets.length > 0 ? (
                    <Badge>
                      {e.bullets.length} {e.bullets.length === 1 ? 'bullet' : 'bullets'}
                    </Badge>
                  ) : null}
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
                onEdit={() => editor.open(toDraft(e), e.id)}
                onDelete={() => del.ask(e, `${e.title} at ${e.org}`)}
              />
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={!!editor.editing}
        title={editor.editing?.id ? 'Edit experience' : 'Add experience'}
        onClose={editor.close}
        onSave={editor.save}
        saving={editor.saving}
        size="lg"
      >
        {d ? (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Type"
                value={d.kind}
                onChange={(v) => editor.patch({ kind: v as Draft['kind'] })}
                options={EXPERIENCE_KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))}
              />
              <TextField label="Title" required value={d.title} onChange={(v) => editor.patch({ title: v })} error={editor.errors.title} />
              <TextField label="Organization" required value={d.org} onChange={(v) => editor.patch({ org: v })} error={editor.errors.org} />
              <TextField
                label="Location"
                value={d.location}
                onChange={(v) => editor.patch({ location: v })}
                error={editor.errors.location}
              />
              <MonthField label="Start" required value={d.start} onChange={(v) => editor.patch({ start: v })} error={editor.errors.start} />
              <MonthField
                label="End"
                value={d.end}
                onChange={(v) => editor.patch({ end: v })}
                error={editor.errors.end}
                hint="Leave empty if this is current."
              />
            </div>
            <TextArea
              label="Description"
              value={d.description}
              onChange={(v) => editor.patch({ description: v })}
              error={editor.errors.description}
              hint={
                isLeadership
                  ? 'Printed after the organisation name on the same grey line, joined with a dash, so it reads best as a continuing phrase such as "led a team that...".'
                  : 'Optional short paragraph printed under the title.'
              }
            />
            <BulletList mode="library" bullets={d.bullets} onChange={(bullets) => editor.patch({ bullets })} errors={editor.errors} />
            <CheckField
              label="Hide from new resumes"
              checked={d.archived}
              onChange={(v) => editor.patch({ archived: v })}
              hint="Existing resumes are not affected."
            />
          </div>
        ) : null}
      </FormDialog>
      {del.dialog}
    </section>
  );
}
