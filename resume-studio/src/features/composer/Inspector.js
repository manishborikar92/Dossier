'use client';
import { TabPanel, Tabs } from '@/components/ui';
import DesignPanel from './DesignPanel.js';
import ChecksPanel from './ChecksPanel.js';
import TargetPanel from './TargetPanel.js';

export default function Inspector({ ed, tab, onTab }) {
  const { checks, pages, options } = ed;
  const issues = (checks.notConfident.length ? 1 : 0) + (pages != null && pages > options.targetPages ? 1 : 0) + (checks.hasEmail ? 0 : 1) + (checks.hasPhone ? 0 : 1) + (checks.longBullets ? 1 : 0);
  const items = [
    { value: 'design', label: 'Design', icon: 'sliders' },
    { value: 'checks', label: 'Checks', icon: 'shield', badge: issues, tone: 'hl' },
    { value: 'target', label: 'Target', icon: 'target' },
  ];
  return (
    <div className="inspector">
      <Tabs idBase="insp" label="Design and checks" value={tab} onChange={onTab} items={items} className="inspector__tabs" />
      <div className="inspector__body">
        <TabPanel idBase="insp" value="design" current={tab}><DesignPanel ed={ed} /></TabPanel>
        <TabPanel idBase="insp" value="checks" current={tab}><ChecksPanel ed={ed} /></TabPanel>
        <TabPanel idBase="insp" value="target" current={tab}><TargetPanel ed={ed} /></TabPanel>
      </div>
    </div>
  );
}
