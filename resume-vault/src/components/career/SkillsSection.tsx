'use client';

import { Wrench } from 'lucide-react';
import { Button, EmptyState, TextField } from '../ui';
import { skillSchema } from '@/lib/schemas';
import type { Skill } from '@/lib/types';
import { useDeleter, useEntityEditor, useEntityList } from './hooks';
import { FormDialog, RowActions, TabIntro } from './parts';

interface Draft {
  name: string;
  category: string;
}

export function SkillsSection({ initial }: { initial: Skill[] }) {
  const list = useEntityList('skills', initial);
  const editor = useEntityEditor<'skills', Draft>('skills', skillSchema, list.reload, 'Skill saved.');
  const del = useDeleter('skills', list.reload, 'Skill');
  const categories = [...new Set(list.items.map((s) => s.category))];
  const grouped = categories.map((category) => ({
    category,
    skills: list.items.map((skill, index) => ({ skill, index })).filter((x) => x.skill.category === category),
  }));
  const d = editor.editing?.draft;

  return (
    <section aria-label="Skills">
      <TabIntro addLabel="Add skill" onAdd={() => editor.open({ name: '', category: categories[0] ?? '' })}>
        List only skills you can talk about in an interview. Categories become the labels on your resume.
      </TabIntro>

      {list.items.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No skills yet"
          action={
            <Button variant="primary" onClick={() => editor.open({ name: '', category: 'Languages' })}>
              Add a skill
            </Button>
          }
        >
          Group skills into categories such as Languages, Frontend or Databases.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {grouped.map((g) => (
            <div key={g.category} className="border-line bg-surface shadow-card overflow-hidden rounded-xl border">
              <div className="border-line bg-sunken flex items-center justify-between border-b px-4 py-2.5">
                <h3 className="text-ink text-sm font-semibold">{g.category}</h3>
                <Button size="sm" variant="ghost" onClick={() => editor.open({ name: '', category: g.category })}>
                  Add to {g.category}
                </Button>
              </div>
              <ul className="divide-line divide-y">
                {g.skills.map(({ skill, index }) => (
                  <li key={skill.id} className="flex items-center justify-between gap-3 px-4 py-1.5">
                    <span className="text-ink text-sm">{skill.name}</span>
                    <RowActions
                      index={index}
                      count={list.items.length}
                      label={skill.name}
                      onMove={(dir) => list.move(index, dir)}
                      onEdit={() => editor.open({ name: skill.name, category: skill.category }, skill.id)}
                      onDelete={() => del.ask(skill, skill.name)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <FormDialog
        open={!!editor.editing}
        title={editor.editing?.id ? 'Edit skill' : 'Add skill'}
        onClose={editor.close}
        onSave={editor.save}
        saving={editor.saving}
        size="sm"
      >
        {d ? (
          <div className="space-y-4">
            <TextField
              label="Skill"
              required
              value={d.name}
              onChange={(v) => editor.patch({ name: v })}
              error={editor.errors.name}
              autoFocus
            />
            <TextField
              label="Category"
              required
              value={d.category}
              onChange={(v) => editor.patch({ category: v })}
              error={editor.errors.category}
              hint={categories.length ? `Existing categories: ${categories.join(', ')}` : 'For example: Languages'}
            />
          </div>
        ) : null}
      </FormDialog>
      {del.dialog}
    </section>
  );
}
