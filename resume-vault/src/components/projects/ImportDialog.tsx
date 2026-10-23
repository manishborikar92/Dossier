'use client';

import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import type { KbImportResult } from '@/lib/types';
import { Button, Dialog, Notice, TextField, useToast } from '../ui';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after a successful import so the list can refresh. */
  onDone: () => Promise<void>;
}

export function ImportDialog({ open, onClose, onDone }: Props) {
  const toast = useToast();
  const [data, setData] = useState<unknown[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [minScore, setMinScore] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KbImportResult | null>(null);

  const close = () => {
    setData(null);
    setFileName('');
    setMinScore('');
    setError('');
    setResult(null);
    onClose();
  };

  async function onFile(file: File | undefined) {
    setResult(null);
    setError('');
    if (!file) return;
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error('This file is not a list of projects.');
      setData(parsed);
      setFileName(file.name);
    } catch (e) {
      setData(null);
      setError(e instanceof SyntaxError ? 'This file is not valid JSON.' : errorMessage(e));
    }
  }

  async function run() {
    if (!data) return;
    const score = minScore.trim() === '' ? undefined : Number(minScore);
    if (score !== undefined && (Number.isNaN(score) || score < 0 || score > 100)) {
      setError('The minimum score must be a number from 0 to 100, or empty.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await api.importer.knowledgeBase(data, score);
      setResult(res);
      await onDone();
      toast.success(`Imported ${res.imported} ${res.imported === 1 ? 'project' : 'projects'}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Import a project knowledge base"
      description="Add many projects at once from a project_knowledge_base.json file."
      footer={
        result ? (
          <Button variant="primary" onClick={close}>
            Done
          </Button>
        ) : (
          <>
            <Button onClick={close}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!data} onClick={run}>
              Import projects
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-ink-2">
          Projects are added to your library with their bullets marked <strong>unverified</strong>. Role, contributions, results and
          repository links are left empty because the file does not state them. Projects already in your library are skipped, so importing
          twice is safe.
        </p>
        <div>
          <label htmlFor="kb-file" className="text-ink-2 mb-1.5 block text-[13px] font-medium">
            JSON file
          </label>
          <input
            id="kb-file"
            type="file"
            accept="application/json,.json"
            onChange={(e) => onFile(e.target.files?.[0])}
            className="border-line-strong bg-sunken file:bg-brand file:hover:bg-brand-hover block w-full cursor-pointer rounded-lg border p-1.5 text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white"
          />
          {data ? (
            <p className="text-muted mt-1.5">
              {fileName}: {data.length} projects found.
            </p>
          ) : null}
        </div>
        <TextField
          label="Skip projects scored below (optional)"
          value={minScore}
          onChange={setMinScore}
          hint="Leave empty to import everything. You can archive projects later."
          className="max-w-xs"
        />
        {error ? (
          <Notice tone="bad" alert>
            {error}
          </Notice>
        ) : null}
        {result ? (
          <Notice tone="ok">
            <p className="font-medium">Imported {result.imported}.</p>
            {result.skipped.length > 0 ? <p>{result.skipped.length} already in your library and left as they are.</p> : null}
            {result.belowMinScore > 0 ? <p>{result.belowMinScore} below the minimum score.</p> : null}
            {result.failed.length > 0 ? (
              <p className="text-bad">
                {result.failed.length} could not be read: {result.failed.map((f) => f.id).join(', ')}.
              </p>
            ) : null}
          </Notice>
        ) : null}
      </div>
    </Dialog>
  );
}
