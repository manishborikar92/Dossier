'use client';

import { Award } from 'lucide-react';
import { Button, EmptyState, TextField } from '../ui';
import { certificationSchema } from '@/lib/schemas';
import type { Certification } from '@/lib/types';
import { useDeleter, useEntityEditor, useEntityList } from './hooks';
import { FormDialog, RowActions, TabIntro, usedBadge } from './parts';

interface Draft {
  name: string;
  issuer: string;
  year: string;
  url: string;
}
const BLANK: Draft = { name: '', issuer: '', year: '', url: '' };

export function CertificationsSection({ initial }: { initial: Certification[] }) {
  const list = useEntityList('certifications', initial);
  const editor = useEntityEditor<'certifications', Draft>('certifications', certificationSchema, list.reload, 'Certification saved.');
  const del = useDeleter('certifications', list.reload, 'Certification');
  const d = editor.editing?.draft;

  return (
    <section aria-label="Certifications">
      <TabIntro addLabel="Add certification" onAdd={() => editor.open(BLANK)}>
        Certificates and other qualifications.
      </TabIntro>

      {list.items.length === 0 ? (
        <EmptyState
          icon={Award}
          title="No certifications yet"
          action={
            <Button variant="primary" onClick={() => editor.open(BLANK)}>
              Add a certification
            </Button>
          }
        />
      ) : (
        <ul className="divide-line border-line bg-surface shadow-card divide-y rounded-xl border">
          {list.items.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 py-4">
              <div className="min-w-0">
                <p className="text-ink font-medium">{c.name}</p>
                <p className="text-muted text-sm">{[c.issuer, c.year].filter(Boolean).join(' \u00b7 ')}</p>
                <div className="mt-2">{usedBadge(c.usedInCount)}</div>
              </div>
              <RowActions
                index={i}
                count={list.items.length}
                label={c.name}
                onMove={(dir) => list.move(i, dir)}
                onEdit={() => editor.open({ name: c.name, issuer: c.issuer, year: c.year, url: c.url }, c.id)}
                onDelete={() => del.ask(c, c.name)}
              />
            </li>
          ))}
        </ul>
      )}

      <FormDialog
        open={!!editor.editing}
        title={editor.editing?.id ? 'Edit certification' : 'Add certification'}
        onClose={editor.close}
        onSave={editor.save}
        saving={editor.saving}
      >
        {d ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Name"
              required
              value={d.name}
              onChange={(v) => editor.patch({ name: v })}
              error={editor.errors.name}
              className="sm:col-span-2"
            />
            <TextField label="Issuer" value={d.issuer} onChange={(v) => editor.patch({ issuer: v })} error={editor.errors.issuer} />
            <TextField label="Year" value={d.year} onChange={(v) => editor.patch({ year: v })} error={editor.errors.year} />
            <TextField
              label="Link to the certificate"
              value={d.url}
              onChange={(v) => editor.patch({ url: v })}
              error={editor.errors.url}
              placeholder="https://"
              className="sm:col-span-2"
            />
          </div>
        ) : null}
      </FormDialog>
      {del.dialog}
    </section>
  );
}
