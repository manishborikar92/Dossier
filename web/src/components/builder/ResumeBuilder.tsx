'use client';

import { Download, ExternalLink, FileDown, History } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { api, errorMessage, resumeFileUrl } from '@/lib/api';
import { cx } from '@/lib/classes';
import type { ResumeDetail } from '@/lib/types';
import { Badge, Button, ConfirmDialog, Menu, PageHeader, Tabs, tabId, tabPanelId, useToast } from '../ui';
import { ContentTab } from './ContentTab';
import { MatchTab } from './MatchTab';
import { PdfPreview } from './PdfPreview';
import { SetupTab } from './SetupTab';
import { VersionsTab } from './VersionsTab';
import { unverifiedCount, type BuilderLibrary } from './helpers';
import type { Mutate } from './types';

type TabId = 'content' | 'match' | 'setup' | 'versions';
type ExportFormat = 'pdf' | 'docx';

export function ResumeBuilder({ initial, library }: { initial: ResumeDetail; library: BuilderLibrary }) {
  const toast = useToast();
  const [state, setState] = useState<ResumeDetail>(initial);
  const [tab, setTab] = useState<TabId>('content');
  const [pane, setPane] = useState<'edit' | 'preview'>('edit');
  const [previewKey, setPreviewKey] = useState(0);
  const [exportAsk, setExportAsk] = useState<ExportFormat | null>(null);
  const { resume, items, versions } = state;
  const id = resume.id;

  const reload = useCallback(async () => {
    setState(await api.resumes.get(id));
    setPreviewKey((k) => k + 1);
  }, [id]);

  const mutate: Mutate = useCallback(
    async (action, successMessage) => {
      try {
        await action();
        await reload();
        if (successMessage) toast.success(successMessage);
        return true;
      } catch (error) {
        toast.error(errorMessage(error));
        // The server may differ from what is on screen; show what is really saved.
        await reload().catch(() => undefined);
        return false;
      }
    },
    [reload, toast],
  );

  const unverified = useMemo(() => items.reduce((n, i) => n + unverifiedCount(i), 0), [items]);
  const outdated = items.filter((i) => i.sync === 'changed').length;

  const download = useCallback(
    (format: ExportFormat) => {
      const link = document.createElement('a');
      link.href = resumeFileUrl(id, format, { download: true });
      link.download = '';
      document.body.appendChild(link);
      link.click();
      link.remove();
      // A version is saved automatically on download; refresh the list shortly after.
      window.setTimeout(() => void reload().catch(() => undefined), 1500);
    },
    [id, reload],
  );

  const startExport = useCallback(
    (format: ExportFormat) => (unverified > 0 ? setExportAsk(format) : download(format)),
    [download, unverified],
  );

  const targetRole = [resume.targetTitle, resume.targetCompany].filter(Boolean).join(' at ');

  const headerActions = useMemo(
    () => (
      <>
        <Button onClick={() => void mutate(() => api.resumes.saveVersion(id), 'Version saved.')}>
          <History className="size-4" aria-hidden />
          Save version
        </Button>
        <Menu
          variant="primary"
          icon={Download}
          label="Export"
          items={[
            {
              label: 'Download PDF',
              description: 'Selectable text, clickable links',
              icon: FileDown,
              onSelect: () => startExport('pdf'),
            },
            {
              label: 'Download Word (.docx)',
              description: 'Editable in Word and Google Docs',
              icon: FileDown,
              onSelect: () => startExport('docx'),
            },
            {
              label: 'Open PDF to print',
              description: 'Opens in a new tab',
              icon: ExternalLink,
              href: resumeFileUrl(id, 'pdf'),
              newTab: true,
            },
          ]}
        />
      </>
    ),
    [id, mutate, startExport],
  );

  const crumbs = useMemo(() => [{ label: 'Resumes', href: '/resumes' }, { label: resume.name }], [resume.name]);

  const meta = useMemo(
    () => (
      <>
        <Badge tone={resume.status === 'final' ? 'ok' : 'neutral'}>{resume.status === 'final' ? 'Final' : 'Draft'}</Badge>
        <span className="text-muted text-sm">{targetRole || 'No target role set'}</span>
        {outdated > 0 ? (
          <Badge tone="warn">
            {outdated} {outdated === 1 ? 'item' : 'items'} changed in library
          </Badge>
        ) : null}
        {unverified > 0 ? (
          <Badge tone="warn">
            {unverified} unverified {unverified === 1 ? 'bullet' : 'bullets'}
          </Badge>
        ) : null}
      </>
    ),
    [outdated, resume.status, targetRole, unverified],
  );

  return (
    <div>
      <div className="border-line bg-surface mb-4 flex gap-1 rounded-lg border p-1 lg:hidden" role="group" aria-label="Show">
        {(['edit', 'preview'] as const).map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pane === p}
            onClick={() => setPane(p)}
            className={cx('flex-1 rounded-md px-3 py-1.5 text-sm font-medium', pane === p ? 'bg-brand text-white' : 'text-ink-2')}
          >
            {p === 'edit' ? 'Edit' : 'Preview'}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]">
        <div className={cx('min-w-0', pane === 'preview' && 'hidden lg:block')}>
          <PageHeader title={resume.name} crumbs={crumbs} meta={meta} actions={headerActions} />

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
          <div role="tabpanel" id={tabPanelId(tab)} aria-labelledby={tabId(tab)} className="pt-5">
            {tab === 'content' ? <ContentTab resume={resume} items={items} library={library} mutate={mutate} /> : null}
            {tab === 'match' ? <MatchTab resume={resume} mutate={mutate} /> : null}
            {tab === 'setup' ? <SetupTab key={resume.updatedAt} resume={resume} mutate={mutate} /> : null}
            {tab === 'versions' ? <VersionsTab resume={resume} versions={versions} mutate={mutate} /> : null}
          </div>
        </div>
        <div className={cx('min-w-0 lg:sticky lg:top-[5.5rem]', pane === 'edit' && 'hidden lg:block')}>
          <PdfPreview resumeId={id} refreshKey={previewKey} />
        </div>
      </div>

      <ConfirmDialog
        open={exportAsk !== null}
        title="Some bullets are not verified"
        confirmLabel="Export anyway"
        onConfirm={() => {
          const format = exportAsk;
          setExportAsk(null);
          if (format) download(format);
        }}
        onCancel={() => setExportAsk(null)}
      >
        <p>
          {unverified} {unverified === 1 ? 'bullet on this resume has' : 'bullets on this resume have'} not been marked verified. They were
          imported or written without you confirming they are accurate.
        </p>
        <p className="text-muted mt-2">
          Check them in your library, hide them, or export anyway if you have already checked them yourself.
        </p>
      </ConfirmDialog>
    </div>
  );
}
