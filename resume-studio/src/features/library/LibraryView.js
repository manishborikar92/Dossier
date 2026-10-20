'use client';
import { useState } from 'react';
import { Button, EmptyState, PageSkeleton, TabPanel, Tabs } from '@/components/ui';
import PageHeader from '@/components/layout/PageHeader';
import { useStore } from '@/components/providers/StoreProvider';
import { libraryStats } from '@/lib/domain/stats';
import CollectionEditor from './CollectionEditor.js';
import { ProfileEditor } from './editors.js';
import ReviewQueue from './ReviewQueue.js';
import KnowledgeBasePanel from './KnowledgeBasePanel.js';
import { SECTIONS, SPECS } from './specs.js';

export default function LibraryView({ initialTab }) {
  const { data, update, error, reload } = useStore();
  const [tab, setTab] = useState(SECTIONS.some((s) => s.value === initialTab) ? initialTab : 'review');

  if (!data) {
    return error
      ? <div className="page"><EmptyState icon="alert" title="Could not load your data" action={<Button variant="primary" onClick={reload}>Try again</Button>}>{error}</EmptyState></div>
      : <PageSkeleton />;
  }

  const choose = (v) => { setTab(v); window.history.replaceState(null, '', `?tab=${v}`); };
  const stats = libraryStats(data);
  const section = SECTIONS.find((s) => s.value === tab);
  const items = SECTIONS.map((s) => ({ value: s.value, label: s.label, icon: s.icon, badge: s.value === 'review' ? stats.review : 0, tone: 'hl' }));

  return (
    <div className="page page--wide">
      <PageHeader title="Library" description="Write things once. Every resume pulls from here." />
      <div className="lib">
        <Tabs idBase="lib" label="Library sections" orientation="vertical" value={tab} onChange={choose} items={items} className="lib__nav" />
        <TabPanel idBase="lib" value={tab} current={tab} className="lib__panel">
          <div className="lib__head"><h2>{section.title}</h2><p>{section.text}</p></div>
          {tab === 'review' && <ReviewQueue data={data} update={update} />}
          {tab === 'profile' && <ProfileEditor profile={data.profile} onChange={(p) => update('profile', p)} />}
          {SPECS[tab] && <CollectionEditor key={tab} items={data[tab]} onChange={(next) => update(tab, next)} spec={SPECS[tab]} />}
          {tab === 'projects' && <KnowledgeBasePanel />}
        </TabPanel>
      </div>
    </div>
  );
}
