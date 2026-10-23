'use client';

import { GraduationCap } from 'lucide-react';
import { Button, EmptyState, MonthField, TextArea, TextField } from '../ui';
import { formatRange } from '@/lib/format';
import { educationSchema } from '@/lib/schemas';
import type { Education } from '@/lib/types';
import { useDeleter, useEntityEditor, useEntityList } from './hooks';
import { FormDialog, RowActions, TabIntro, usedBadge } from './parts';

type Draft = Omit<Education, 'id' | 'version' | 'sort' | 'usedInCount' | 'createdAt' | 'updatedAt'>;
const BLANK: Draft = { institution: '', degree: '', field: '', location: '', start: '', end: '', grade: '', details: '' };

export function EducationSection({ initial }: { initial: Education[] }) {
  const list = useEntityList('education', initial);
  const editor = useEntityEditor<'education', Draft>('education', educationSchema, list.reload, 'Education saved.');
  const del = useDeleter('education', list.reload, 'Education entry');
  const d = editor.editing?.draft;

  return (
    <section aria-label="Education">
      <TabIntro addLabel="Add education" onAdd={() => editor.open(BLANK)}>
        Degrees, diplomas and school qualifications.
      </TabIntro>

      {list.items.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="No education yet"
          action={
            <Button variant="primary" onClick={() => editor.open(BLANK)}>
              Add education
            </Button>
          }
        >
          Add your degrees and qualifications once. Each resume can show or hide them.
        </EmptyState>
      ) : (
        <ul className="divide-line border-line bg-surface shadow-card divide-y rounded-xl border">
          {list.items.map((e, i) => (
            <li key={e.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4">
              <div className="min-w-0">
                <p className="text-ink font-medium">{[e.degree, e.field].filter(Boolean).join(' \u2013 ')}</p>
                <p className="text-muted text-sm">
                  {[e.institution, e.grade, formatRange(e.start, e.end, 'long')].filter(Boolean).join(' \u00b7 ')}
                </p>
                <div className="mt-2">{usedBadge(e.usedInCount)}</div>
              </div>
              <RowActions
                index={i}
                count={list.items.length}
                label={e.degree}
                onMove={(dir) => list.move(i, dir)}
                onEdit={() => editor.open({ ...e }, e.id)}
                onDelete={() => del.ask(e, `${e.degree}, ${e.institution}`)}
              />
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={!!editor.editing}
        title={editor.editing?.id ? 'Edit education' : 'Add education'}
        onClose={editor.close}
        onSave={editor.save}
        saving={editor.saving}
      >
        {d ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Degree or qualification"
              required
              value={d.degree}
              onChange={(v) => editor.patch({ degree: v })}
              error={editor.errors.degree}
              className="sm:col-span-2"
              hint="For example: B.Tech"
            />
            <TextField label="Field of study" value={d.field} onChange={(v) => editor.patch({ field: v })} error={editor.errors.field} />
            <TextField
              label="Institution"
              required
              value={d.institution}
              onChange={(v) => editor.patch({ institution: v })}
              error={editor.errors.institution}
            />
            <TextField label="Location" value={d.location} onChange={(v) => editor.patch({ location: v })} error={editor.errors.location} />
            <TextField
              label="Grade or score"
              value={d.grade}
              onChange={(v) => editor.patch({ grade: v })}
              error={editor.errors.grade}
              hint="Printed as you type it, e.g. CGPA: 8.1/10"
            />
            <MonthField label="Start" value={d.start} onChange={(v) => editor.patch({ start: v })} error={editor.errors.start} />
            <MonthField label="End or graduation" value={d.end} onChange={(v) => editor.patch({ end: v })} error={editor.errors.end} />
            <TextArea
              label="Details"
              value={d.details}
              onChange={(v) => editor.patch({ details: v })}
              error={editor.errors.details}
              className="sm:col-span-2"
            />
          </div>
        ) : null}
      </FormDialog>
      {del.dialog}
    </section>
  );
}
