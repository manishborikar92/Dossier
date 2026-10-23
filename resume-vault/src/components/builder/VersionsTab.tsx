'use client';

import { Download, ExternalLink, History, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { api, resumeFileUrl } from '@/lib/api';
import { buttonClass } from '@/lib/classes';
import { formatDateTime } from '@/lib/format';
import type { ResumeRecord, ResumeVersion } from '@/lib/types';
import { Badge, Button, ConfirmDialog, EmptyState, TextField } from '../ui';
import type { Mutate } from './types';

const REASON: Record<string, string> = {
  manual: 'Saved by you',
  export: 'Saved when exported',
  'before-restore': 'Saved before a restore',
};

export function VersionsTab({ resume, versions, mutate }: { resume: ResumeRecord; versions: ResumeVersion[]; mutate: Mutate }) {
  const [label, setLabel] = useState('');
  const [restoring, setRestoring] = useState<ResumeVersion | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-muted text-sm">
        A version is a frozen copy of this resume exactly as it is now. Later edits never change it, and you can export it again at any
        time. A version is also saved automatically whenever you download a PDF or Word file, so you can always see exactly what you sent.
      </p>
      <div className="border-line bg-surface shadow-card flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <TextField
          label="Version label (optional)"
          value={label}
          onChange={setLabel}
          placeholder="e.g. Sent to Acme, 12 March"
          className="min-w-64 flex-1"
        />
        <Button
          variant="primary"
          onClick={async () => {
            const ok = await mutate(() => api.resumes.saveVersion(resume.id, label), 'Version saved.');
            if (ok) setLabel('');
          }}
        >
          <History className="size-4" aria-hidden />
          Save version
        </Button>
      </div>

      {versions.length === 0 ? (
        <EmptyState icon={History} title="No versions yet">
          Save one before you send this resume anywhere.
        </EmptyState>
      ) : (
        <ul className="divide-line border-line bg-surface shadow-card divide-y rounded-xl border">
          {versions.map((v) => (
            <li key={v.id} className="px-4 py-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-ink text-sm font-semibold">
                  Version {v.number}
                  {v.label ? (
                    <span className="text-muted font-normal">
                      {' \u2014 '}
                      {v.label}
                    </span>
                  ) : null}
                </p>
                <Badge>{REASON[v.reason] ?? v.reason}</Badge>
              </div>
              <p className="text-muted text-xs">{formatDateTime(v.createdAt)}</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <a
                  href={resumeFileUrl(resume.id, 'pdf', { version: v.id })}
                  target="_blank"
                  rel="noreferrer"
                  className={buttonClass('secondary', 'sm')}
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open PDF
                </a>
                <a href={resumeFileUrl(resume.id, 'pdf', { version: v.id, download: true })} className={buttonClass('secondary', 'sm')}>
                  <Download className="size-3.5" aria-hidden />
                  PDF
                </a>
                <a href={resumeFileUrl(resume.id, 'docx', { version: v.id, download: true })} className={buttonClass('secondary', 'sm')}>
                  <Download className="size-3.5" aria-hidden />
                  Word
                </a>
                <Button size="sm" onClick={() => setRestoring(v)}>
                  <RotateCcw className="size-3.5" aria-hidden />
                  Restore this version
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={restoring !== null}
        title={`Restore version ${restoring?.number}?`}
        confirmLabel="Restore"
        onConfirm={async () => {
          if (!restoring) return;
          const target = restoring;
          setRestoring(null);
          await mutate(() => api.resumes.restoreVersion(resume.id, target.id), `Restored version ${target.number}.`);
        }}
        onCancel={() => setRestoring(null)}
      >
        <p>This replaces the current content, template and settings of this resume with the saved version.</p>
        <p className="text-muted mt-2">Your current state is saved as a new version first, so nothing is lost.</p>
      </ConfirmDialog>
    </div>
  );
}
