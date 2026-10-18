'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import { TEMPLATES } from '@/lib/templates';
import { Button, ConfirmDialog, SelectField, buttonClass, useToast } from './ui';

interface Props {
  defaults: { defaultPageSize: 'A4' | 'LETTER'; defaultTemplate: string };
  databasePath: string;
  backupsPath: string;
  counts: { label: string; value: number }[];
}

export function SettingsPanel({ defaults, databasePath, backupsPath, counts }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pageSize, setPageSize] = useState(defaults.defaultPageSize);
  const [template, setTemplate] = useState(defaults.defaultTemplate);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);
  const [fileError, setFileError] = useState('');
  const [restoring, setRestoring] = useState(false);

  async function saveDefaults() {
    setSaving(true);
    try {
      await api('/api/settings', { method: 'PUT', body: { defaultPageSize: pageSize, defaultTemplate: template } });
      toast.success('Defaults saved.');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function chooseFile(file: File | undefined) {
    setFileError('');
    setPending(null);
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data?.app !== 'resume-vault') throw new Error('This file is not a Resume Vault backup.');
      setPending({ name: file.name, data });
    } catch (error) {
      setFileError(error instanceof SyntaxError ? 'This file is not valid JSON.' : errorMessage(error));
    }
  }

  async function restore() {
    if (!pending) return;
    setRestoring(true);
    try {
      await api('/api/backup/restore', { body: pending.data });
      toast.success('Backup restored.');
      setPending(null);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="backup" className="rounded-lg border border-rule bg-surface p-5">
        <h2 id="backup" className="font-serif text-lg font-semibold">Backup and restore</h2>
        <p className="mb-4 max-w-2xl text-sm text-muted">
          A backup is one JSON file with your profile, library, resumes and saved versions. Keep copies somewhere safe, and download a fresh one before big changes.
        </p>
        <ul className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {counts.map((c) => (
            <li key={c.label}>
              <span className="font-semibold">{c.value}</span> <span className="text-muted">{c.label}</span>
            </li>
          ))}
        </ul>
        <a href="/api/backup" download className={buttonClass('primary')}>
          <Download className="h-4 w-4" aria-hidden />
          Download backup
        </a>

        <div className="mt-6 border-t border-rule pt-5">
          <h3 className="text-sm font-semibold">Restore from a backup file</h3>
          <p className="mb-3 mt-1 max-w-2xl text-sm text-muted">
            Restoring <strong>replaces everything</strong> currently in the app. A copy of the current database is saved first, and the restore is all-or-nothing.
          </p>
          <label htmlFor="restore-file" className="sr-only">Backup file</label>
          <input id="restore-file" ref={fileRef} type="file" accept="application/json,.json" onChange={(e) => chooseFile(e.target.files?.[0])} className="block text-sm" />
          {fileError ? <p role="alert" className="mt-2 text-sm font-medium text-bad">{fileError}</p> : null}
          <RestoreButton pending={pending} onConfirm={restore} busy={restoring} />
        </div>
      </section>

      <section aria-labelledby="defaults" className="rounded-lg border border-rule bg-surface p-5">
        <h2 id="defaults" className="font-serif text-lg font-semibold">Defaults for new resumes</h2>
        <p className="mb-4 text-sm text-muted">Each resume can still override these.</p>
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <SelectField label="Page size" value={pageSize} onChange={(v) => setPageSize(v as 'A4' | 'LETTER')} options={[{ value: 'A4', label: 'A4' }, { value: 'LETTER', label: 'US Letter' }]} />
          <SelectField label="Template" value={template} onChange={setTemplate} options={Object.values(TEMPLATES).map((t) => ({ value: t.id, label: t.label }))} />
        </div>
        <Button className="mt-4" variant="primary" loading={saving} onClick={saveDefaults}>Save defaults</Button>
      </section>

      <section aria-labelledby="storage" className="rounded-lg border border-rule bg-surface p-5">
        <h2 id="storage" className="font-serif text-lg font-semibold">Where your data lives</h2>
        <dl className="mt-2 space-y-2 text-sm">
          <div>
            <dt className="font-medium">Database file</dt>
            <dd className="break-all font-mono text-[13px] text-muted">{databasePath}</dd>
          </div>
          <div>
            <dt className="font-medium">Automatic safety copies</dt>
            <dd className="break-all font-mono text-[13px] text-muted">{backupsPath}</dd>
            <dd className="mt-0.5 text-muted">Written before a restore and before the database structure is upgraded.</dd>
          </div>
        </dl>
        <p className="mt-3 max-w-2xl text-sm text-muted">
          Nothing is sent to any server. To move to another computer, download a backup here and restore it there, or copy the database file while the app is stopped.
        </p>
      </section>
    </div>
  );
}

function RestoreButton({ pending, onConfirm, busy }: { pending: { name: string } | null; onConfirm: () => void; busy: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="mt-3" variant="danger" disabled={!pending} onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" aria-hidden />
        Restore this backup
      </Button>
      <ConfirmDialog
        open={open}
        title="Replace everything with this backup?"
        confirmLabel="Replace and restore"
        danger
        busy={busy}
        onConfirm={() => {
          onConfirm();
          setOpen(false);
        }}
        onCancel={() => setOpen(false)}
      >
        <p>
          Everything currently in the app will be replaced by <strong>{pending?.name}</strong>. A safety copy of the current database is saved first.
        </p>
      </ConfirmDialog>
    </>
  );
}
