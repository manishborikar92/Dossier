'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Download, ExternalLink, History } from 'lucide-react';
import { api, errorMessage } from '@/lib/client';
import type { ResumeItem, ResumeRecord, ResumeVersion } from '@/lib/types';
import { Badge, Button, ConfirmDialog, Tabs, buttonClass, cx, useToast } from '../ui';
import { ContentTab } from './ContentTab';
import { MatchTab } from './MatchTab';
import { PdfPreview, type PreviewInfo } from './PdfPreview';
import { SetupTab } from './SetupTab';
import { VersionsTab } from './VersionsTab';
import { unverifiedCount, type BuilderLibrary } from './helpers';

type TabId = 'content' | 'match' | 'setup' | 'versions';
interface ResumePayload {
  resume: ResumeRecord;
  items: ResumeItem[];
  versions: ResumeVersion[];
}

export function ResumeBuilder({ initial, library }: { initial: ResumePayload; library: BuilderLibrary }) {
  const toast = useToast();
  const [state, setState] = useState<ResumePayload>(initial);
  const [tab, setTab] = useState<TabId>('content');
  const [pane, setPane] = useState<'edit' | 'preview'>('edit');
  const [previewKey, setPreviewKey] = useState(0);
  const [info, setInfo] = useState<PreviewInfo | null>(null);
  const [exportAsk, setExportAsk] = useState<'pdf' | 'docx' | null>(null);
  const { resume, items, versions } = state;

  const id = resume.id;
  const reload = useCallback(async () => {
    const data = await api<ResumePayload>(`/api/resumes/${id}`);
    setState(data);
    setPreviewKey((k) => k + 1);
  }, [id]);

  /** Run a change, show any error, then refresh the resume and the preview. */
  const mutate = useCallback(
    async (action: () => Promise<unknown>, successMessage?: string): Promise<boolean> => {
      try {
        await action();
        await reload();
        if (successMessage) toast.success(successMessage);
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        // The server state may differ from what is on screen; show what is really saved.
        try {
          await reload();
        } catch {
          /* ignore */
        }
        return false;
      }
    },
    [reload, toast],
  );

  const unverified = useMemo(() => items.reduce((n, i) => n + unverifiedCount(i), 0), [items]);

  function startExport(format: 'pdf' | 'docx') {
    if (unverified > 0) setExportAsk(format);
    else doExport(format);
  }
  function doExport(format: 'pdf' | 'docx') {
    const link = document.createElement('a');
    link.href = `/api/resumes/${id}/${format}?download=1`;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // A version is saved automatically on download; refresh the list shortly after.
    window.setTimeout(() => void reload().catch(() => undefined), 1500);
  }

  const outdated = items.filter((i) => i.sync === 'changed').length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/resumes" className="mb-1 inline-flex items-center gap-1 text-sm text-navy underline underline-offset-2">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            All resumes
          </Link>
          <h1 className="page-title break-words">{resume.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted">
            <Badge tone={resume.status === 'final' ? 'ok' : 'neutral'}>{resume.status === 'final' ? 'Final' : 'Draft'}</Badge>
            <span>{[resume.targetTitle, resume.targetCompany].filter(Boolean).join(' at ') || 'No target role set'}</span>
            {outdated > 0 ? <Badge tone="warn">{outdated} {outdated === 1 ? 'item' : 'items'} changed in library</Badge> : null}
            {unverified > 0 ? <Badge tone="warn">{unverified} unverified {unverified === 1 ? 'bullet' : 'bullets'}</Badge> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => void mutate(() => api(`/api/resumes/${id}/versions`, { body: {} }), 'Version saved.')}
          >
            <History className="h-4 w-4" aria-hidden />
            Save version
          </Button>
          <a href={`/api/resumes/${id}/pdf`} target="_blank" rel="noreferrer" className={buttonClass('secondary')}>
            <ExternalLink className="h-4 w-4" aria-hidden />
            Open PDF
          </a>
          <Button onClick={() => startExport('docx')}>
            <Download className="h-4 w-4" aria-hidden />
            Word
          </Button>
          <Button variant="primary" onClick={() => startExport('pdf')}>
            <Download className="h-4 w-4" aria-hidden />
            Download PDF
          </Button>
        </div>
      </div>

      <div className="mb-3 flex gap-1 rounded-md border border-rule bg-surface p-1 lg:hidden" role="group" aria-label="Show">
        {(['edit', 'preview'] as const).map((p) => (
          <button key={p} type="button" aria-pressed={pane === p} onClick={() => setPane(p)} className={cx('flex-1 rounded px-3 py-1.5 text-sm font-medium', pane === p ? 'bg-navy text-white' : 'text-ink')}>
            {p === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div className={cx('min-w-0', pane === 'preview' && 'hidden lg:block')}>
          <Tabs
            label="Resume sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { id: 'content', label: 'Content' },
              { id: 'match', label: 'Match a job' },
              { id: 'setup', label: 'Setup' },
              { id: 'versions', label: 'Versions', badge: <Badge>{versions.length}</Badge> },
            ]}
          />
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-5">
            {tab === 'content' ? <ContentTab resume={resume} items={items} library={library} mutate={mutate} /> : null}
            {tab === 'match' ? <MatchTab resume={resume} mutate={mutate} /> : null}
            {tab === 'setup' ? <SetupTab key={resume.updatedAt} resume={resume} mutate={mutate} /> : null}
            {tab === 'versions' ? <VersionsTab resume={resume} versions={versions} mutate={mutate} /> : null}
          </div>
        </div>
        <div className={cx('min-w-0 lg:sticky lg:top-4 lg:self-start', pane === 'edit' && 'hidden lg:block')}>
          <PdfPreview resumeId={id} refreshKey={previewKey} onInfo={setInfo} />
          {info && info.pages > 2 ? <p className="mt-2 text-xs text-muted">This resume runs to {info.pages} pages. Hide older items or tighten the spacing in Setup if you want it shorter.</p> : null}
        </div>
      </div>

      <ConfirmDialog
        open={exportAsk !== null}
        title="Some bullets are not verified"
        confirmLabel="Export anyway"
        onConfirm={() => {
          const format = exportAsk;
          setExportAsk(null);
          if (format) doExport(format);
        }}
        onCancel={() => setExportAsk(null)}
      >
        <p>
          {unverified} {unverified === 1 ? 'bullet on this resume has' : 'bullets on this resume have'} not been marked verified. They were imported or written without you confirming they are accurate.
        </p>
        <p className="mt-2 text-muted">Check them in your library, hide them, or export anyway if you have already checked them yourself.</p>
      </ConfirmDialog>
    </div>
  );
}
