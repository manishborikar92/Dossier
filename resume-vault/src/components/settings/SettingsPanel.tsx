'use client';

import { Download, HardDrive, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { BACKUP_URL, api, errorMessage } from '@/lib/api';
import { buttonClass } from '@/lib/classes';
import { TEMPLATES } from '@/lib/templates';
import type { TemplateId } from '@/lib/types';
import { Button, ConfirmDialog, Notice, SectionCard, SelectField, useToast } from '../ui';
import { useHeader } from '../layout/HeaderContext';

interface Props {
  defaults: { defaultPageSize: 'A4' | 'LETTER'; defaultTemplate: TemplateId };
  databasePath: string;
  backupsPath: string;
  counts: { label: string; value: number }[];
}

export function SettingsPanel({ defaults, databasePath, backupsPath, counts }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pageSize, setPageSize] = useState(defaults.defaultPageSize);
  const [template, setTemplate] = useState<TemplateId>(defaults.defaultTemplate);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<{ name: string; data: unknown } | null>(null);
  const [fileError, setFileError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useHeader({
    crumbs: [{ label: 'Settings & backup' }],
    title: 'Settings & backup',
  });

  async function saveDefaults() {
    setSaving(true);
    try {
      await api.settings.save({ defaultPageSize: pageSize, defaultTemplate: template });
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
      const data = JSON.parse(await file.text()) as { app?: string };
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
      await api.backup.restore(pending.data);
      toast.success('Backup restored.');
      setPending(null);
      setConfirmOpen(false);
      if (fileRef.current) fileRef.current.value = '';
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionCard
        id="backup"
        title="Backup and restore"
        description="A backup is one JSON file with your profile, library, resumes and saved versions. Download a fresh one before big changes."
      >
        <ul className="mb-5 flex flex-wrap gap-x-8 gap-y-2">
          {counts.map((c) => (
            <li key={c.label} className="text-sm">
              <span className="text-ink text-lg font-semibold tabular-nums">{c.value}</span> <span className="text-muted">{c.label}</span>
            </li>
          ))}
        </ul>
        <a href={BACKUP_URL} download className={buttonClass('primary')}>
          <Download className="size-4" aria-hidden />
          Download backup
        </a>

        <div className="border-line mt-6 border-t pt-5">
          <h3 className="text-ink text-sm font-semibold">Restore from a backup file</h3>
          <p className="text-muted mt-1 mb-3 max-w-2xl text-sm">
            Restoring <strong className="text-ink-2">replaces everything</strong> currently in the app. A copy of the current database is
            saved first, and the restore is all-or-nothing.
          </p>
          <label htmlFor="restore-file" className="sr-only">
            Backup file
          </label>
          <input
            id="restore-file"
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            onChange={(e) => chooseFile(e.target.files?.[0])}
            className="border-line-strong bg-sunken file:bg-brand file:hover:bg-brand-hover block w-full max-w-md cursor-pointer rounded-lg border p-1.5 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
          />
          {fileError ? (
            <Notice tone="bad" alert className="mt-3 max-w-md">
              {fileError}
            </Notice>
          ) : null}
          <Button className="mt-3" variant="danger" disabled={!pending} onClick={() => setConfirmOpen(true)}>
            <Upload className="size-4" aria-hidden />
            Restore this backup
          </Button>
        </div>
      </SectionCard>

      <SectionCard id="defaults" title="Defaults for new resumes" description="Each resume can still override these.">
        <div className="grid max-w-xl gap-4 sm:grid-cols-2">
          <SelectField
            label="Page size"
            value={pageSize}
            onChange={(v) => setPageSize(v as 'A4' | 'LETTER')}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'LETTER', label: 'US Letter' },
            ]}
          />
          <SelectField
            label="Template"
            value={template}
            onChange={(v) => setTemplate(v as TemplateId)}
            options={Object.values(TEMPLATES).map((t) => ({ value: t.id, label: t.label }))}
          />
        </div>
        <Button className="mt-4" variant="primary" loading={saving} onClick={saveDefaults}>
          Save defaults
        </Button>
      </SectionCard>

      <SectionCard id="storage" title="Where your data lives" description="Nothing is sent to any server.">
        <dl className="space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <HardDrive className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <dt className="text-ink font-medium">Database file</dt>
              <dd className="text-muted font-mono text-[13px] break-all">{databasePath}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <HardDrive className="text-muted mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <dt className="text-ink font-medium">Automatic safety copies</dt>
              <dd className="text-muted font-mono text-[13px] break-all">{backupsPath}</dd>
              <dd className="text-muted mt-0.5">Written before a restore and before the database structure is upgraded.</dd>
            </div>
          </div>
        </dl>
        <p className="text-muted mt-4 max-w-2xl text-sm">
          To move to another computer, download a backup here and restore it there, or copy the database file while the app is stopped.
        </p>
      </SectionCard>

      <ConfirmDialog
        open={confirmOpen}
        title="Replace everything with this backup?"
        confirmLabel="Replace and restore"
        danger
        busy={restoring}
        onConfirm={restore}
        onCancel={() => setConfirmOpen(false)}
      >
        <p>
          Everything currently in the app will be replaced by <strong>{pending?.name}</strong>. A safety copy of the current database is
          saved first.
        </p>
      </ConfirmDialog>
    </div>
  );
}
