'use client';

import { useState } from 'react';
import { Download, ExternalLink, History } from 'lucide-react';
import { api } from '@/lib/client';
import { formatDateTime } from '@/lib/format';
import type { ResumeRecord, ResumeVersion } from '@/lib/types';
import { Badge, Button, ConfirmDialog, EmptyState, TextField, buttonClass } from '../ui';

const REASON: Record<string, string> = { manual: 'Saved by you', export: 'Saved when exported', 'before-restore': 'Saved before a restore' };

export function VersionsTab({ resume, versions, mutate }: { resume: ResumeRecord; versions: ResumeVersion[]; mutate: (a: () => Promise<unknown>, m?: string) => Promise<boolean> }) {
  const [label, setLabel] = useState('');
  const [restoring, setRestoring] = useState<ResumeVersion | null>(null);

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        A version is a frozen copy of this resume exactly as it is now. Later edits never change it, and you can export it again at any time. A version is also saved automatically whenever you download a PDF or Word file, so you can always see exactly what you sent.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <TextField label="Version label (optional)" value={label} onChange={setLabel} placeholder="e.g. Sent to Acme, 12 March" className="min-w-[16rem] flex-1" />
        <Button
          variant="primary"
          onClick={async () => {
            const ok = await mutate(() => api(`/api/resumes/${resume.id}/versions`, { body: { label } }), 'Version saved.');
            if (ok) setLabel('');
          }}
        >
          <History className="h-4 w-4" aria-hidden />
          Save version
        </Button>
      </div>

      {versions.length === 0 ? (
        <EmptyState title="No versions yet">Save one before you send this resume anywhere.</EmptyState>
      ) : (
        <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
          {versions.map((v) => (
            <li key={v.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  Version {v.number}
                  {v.label ? <span className="font-normal text-muted">{' \u2014 '}{v.label}</span> : null}
                </p>
                <Badge>{REASON[v.reason] ?? v.reason}</Badge>
              </div>
              <p className="text-xs text-muted">{formatDateTime(v.createdAt)}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={`/api/resumes/${resume.id}/pdf?version=${v.id}`} target="_blank" rel="noreferrer" className={buttonClass('secondary', 'sm')}>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  Open PDF
                </a>
                <a href={`/api/resumes/${resume.id}/pdf?version=${v.id}&download=1`} className={buttonClass('secondary', 'sm')}>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  PDF
                </a>
                <a href={`/api/resumes/${resume.id}/docx?version=${v.id}&download=1`} className={buttonClass('secondary', 'sm')}>
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Word
                </a>
                <Button size="sm" onClick={() => setRestoring(v)}>Restore this version</Button>
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
          await mutate(() => api(`/api/resumes/${resume.id}/versions/${target.id}`, { body: { action: 'restore' } }), `Restored version ${target.number}.`);
        }}
        onCancel={() => setRestoring(null)}
      >
        <p>This replaces the current content, template and settings of this resume with the saved version.</p>
        <p className="mt-2 text-muted">Your current state is saved as a new version first, so nothing is lost.</p>
      </ConfirmDialog>
    </div>
  );
}
