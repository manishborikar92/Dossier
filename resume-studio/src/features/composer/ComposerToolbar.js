'use client';
import Link from 'next/link';
import { Badge, Button, Icon, Menu } from '@/components/ui';
import SaveIndicator from '@/components/layout/SaveIndicator';
import ThemeToggle from '@/components/layout/ThemeToggle';

export default function ComposerToolbar({ ed, onShowChecks }) {
  const { resume, pages, options } = ed;
  const target = options.targetPages;
  const ok = pages != null && pages <= target;
  return (
    <header className="ctb">
      <Button variant="ghost" icon="chevron-left" href="/">Resumes</Button>
      <input className="ctb__name" aria-label="Resume name" value={resume.name} onChange={(e) => ed.rename(e.target.value)} />
      <SaveIndicator />
      <span className="grow" />
      <button type="button" className={`pagechip ${pages == null ? '' : ok ? 'pagechip--ok' : 'pagechip--warn'}`} onClick={onShowChecks} title={`Exact page count from the PDF renderer. Your target is ${target}. Click for length options.`}>
        <Icon name={pages == null || ok ? 'file' : 'alert'} size={15} />
        {pages == null ? 'Counting pages' : `${pages} ${pages === 1 ? 'page' : 'pages'}`}
        {pages != null && !ok && <span>over target of {target}</span>}
      </button>
      <ThemeToggle />
      <Button variant="ghost" icon="list" href={`/prep/${resume.id}`}>Interview prep</Button>
      <Menu
        label="Export" icon="download" variant="primary"
        items={[
          { label: 'Download DOCX', icon: 'download', onSelect: () => ed.exportAs('docx') },
          { label: 'Download PDF', icon: 'download', onSelect: () => ed.exportAs('pdf') },
          { label: 'Open PDF in a new tab', icon: 'external', onSelect: () => ed.exportAs('pdf', true) },
          { label: 'Download plain text', icon: 'download', onSelect: () => ed.exportAs('txt') },
        ]}
      />
    </header>
  );
}
