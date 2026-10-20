'use client';
import { useState } from 'react';
import { Button, EmptyState, PageSkeleton, Segmented } from '@/components/ui';
import { useResumeEditor } from './useResumeEditor.js';
import ComposerToolbar from './ComposerToolbar.js';
import ContentPanel from './ContentPanel.js';
import PreviewPane from './PreviewPane.js';
import Inspector from './Inspector.js';

/** Full-bleed workspace: content on the left, the paper in the middle, design and checks on the right. */
export default function ComposerView({ id }) {
  const ed = useResumeEditor(id);
  const [view, setView] = useState('preview'); // which pane shows on narrow screens
  const [tab, setTab] = useState('design');

  if (!ed.data) {
    return ed.error
      ? <div className="page"><EmptyState icon="alert" title="Could not load your data">{ed.error}</EmptyState></div>
      : <PageSkeleton />;
  }
  if (!ed.resume) {
    return <div className="page"><EmptyState icon="search" title="Resume not found" action={<Button variant="primary" href="/">Back to your resumes</Button>}>It may have been deleted.</EmptyState></div>;
  }

  return (
    <div className="composer" data-view={view}>
      <ComposerToolbar ed={ed} onShowChecks={() => { setTab('checks'); setView('inspector'); }} />
      <div className="composer__switch">
        <Segmented label="Editor view" value={view} onChange={setView} options={[{ value: 'content', label: 'Content' }, { value: 'preview', label: 'Preview' }, { value: 'inspector', label: 'Design and checks' }]} />
      </div>
      <div className="composer__body">
        <section className="pane pane--content" aria-label="Content"><ContentPanel ed={ed} /></section>
        <section className="pane pane--preview" aria-label="Preview"><PreviewPane ed={ed} /></section>
        <aside className="pane pane--inspector" aria-label="Design and checks"><Inspector ed={ed} tab={tab} onTab={setTab} /></aside>
      </div>
    </div>
  );
}
