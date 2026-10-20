'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, EmptyState, Icon, PageSkeleton } from '@/components/ui';
import PageHeader from '@/components/layout/PageHeader';
import { useStore } from '@/components/providers/StoreProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { useConfirm } from '@/components/providers/ConfirmProvider';
import { createResume } from '@/lib/client/actions';
import { libraryStats } from '@/lib/domain/stats';
import HonestyPanel from './HonestyPanel.js';
import GettingStarted from './GettingStarted.js';
import ResumeCard from './ResumeCard.js';
import NewResumeDialog from './NewResumeDialog.js';

export default function DashboardView({ openNew = false }) {
  const store = useStore();
  const { data, update, error, reload } = store;
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [newOpen, setNewOpen] = useState(openNew);

  if (!data) {
    return error
      ? <div className="page"><EmptyState icon="alert" title="Could not load your data" action={<Button variant="primary" onClick={reload}>Try again</Button>}>{error}</EmptyState></div>
      : <PageSkeleton />;
  }

  const stats = libraryStats(data);
  const targetName = (id) => data.targets.find((t) => t.id === id)?.name;

  const duplicate = async (r) => {
    const copy = await createResume(store, { mode: 'duplicate', sourceId: r.id, name: `${r.name} (copy)` });
    toast({ tone: 'ok', title: 'Copy created', description: copy.name, action: { label: 'Open', onClick: () => router.push(`/resume/${copy.id}`) } });
  };
  const remove = async (r) => {
    if (!(await confirm({ title: `Delete "${r.name}"?`, body: 'The resume recipe is removed. Your library is not affected.', confirmLabel: 'Delete resume', danger: true }))) return;
    const index = data.resumes.findIndex((x) => x.id === r.id);
    update('resumes', (arr) => arr.filter((x) => x.id !== r.id));
    toast({
      tone: 'info', title: 'Resume deleted', description: r.name,
      action: { label: 'Undo', onClick: () => update('resumes', (arr) => [...arr.slice(0, index), r, ...arr.slice(index)]) },
    });
  };

  return (
    <div className="page">
      <PageHeader
        title="Resumes"
        description="Every resume is a recipe built from your library, so fixing a bullet once fixes it everywhere."
        actions={<Button variant="primary" icon="plus" onClick={() => setNewOpen(true)}>New resume</Button>}
      />
      <HonestyPanel stats={stats} />
      <GettingStarted stats={stats} data={data} onNewResume={() => setNewOpen(true)} />

      <section aria-labelledby="shelf-h" className="shelf-section">
        <h2 id="shelf-h" className="section-title">Your resumes</h2>
        <ul className="shelf">
          {data.resumes.map((r) => (
            <li key={r.id}>
              <ResumeCard resume={r} data={data} targetName={targetName(r.targetId)} onDuplicate={() => duplicate(r)} onDelete={() => remove(r)} />
            </li>
          ))}
          <li>
            <button type="button" className="sheetslot" onClick={() => setNewOpen(true)}>
              <Icon name="plus" size={22} />
              <span>New resume</span>
            </button>
          </li>
        </ul>
      </section>

      <footer className="page-foot">
        <p>Your data lives in the <code>data</code> folder next to the app. Copy that folder to back it up, or download everything as one file.</p>
        <Button size="sm" icon="download" href="/api/data/_all?download=1" download>Download backup</Button>
      </footer>
      {newOpen && <NewResumeDialog open={newOpen} onClose={() => setNewOpen(false)} />}
    </div>
  );
}
