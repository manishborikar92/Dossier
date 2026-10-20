'use client';
import { useMemo } from 'react';
import Link from 'next/link';
import { Badge, Menu } from '@/components/ui';
import ResumePreview from '@/features/preview/ResumePreview';
import { buildModel } from '@/lib/domain/model';
import { TEMPLATES } from '@/lib/domain/templates';
import { timeAgo } from '@/lib/client/format';

/** A resume as a sheet of paper (a live thumbnail), with its facts beside it. */
export default function ResumeCard({ resume, data, targetName, onDuplicate, onDelete }) {
  const model = useMemo(() => buildModel(data, resume), [data, resume]);
  const bullets = resume.selection.experience.reduce((n, e) => n + e.bullets.length, 0) + resume.selection.projects.reduce((n, p) => n + p.bullets.length, 0);
  const url = (fmt) => `/api/export/${resume.id}?format=${fmt}`;
  return (
    <article className="sheetcard">
      <Link href={`/resume/${resume.id}`} className="sheetcard__paper" tabIndex={-1} aria-hidden="true">
        <div className="sheetcard__thumb" aria-hidden="true"><ResumePreview model={model} zoom={0.26} compact /></div>
      </Link>
      <div className="sheetcard__body">
        <h3 className="sheetcard__name"><Link href={`/resume/${resume.id}`}>{resume.name}</Link></h3>
        <p className="sheetcard__target">{targetName ? `For ${targetName}` : 'No target set'}</p>
        <dl className="facts">
          <div><dt>Projects</dt><dd>{resume.selection.projects.length}</dd></div>
          <div><dt>Bullets</dt><dd>{bullets}</dd></div>
          <div><dt>Edited</dt><dd>{timeAgo(resume.updatedAt || resume.createdAt)}</dd></div>
        </dl>
        <div className="sheetcard__foot">
          <Badge tone="muted">{TEMPLATES[resume.template]?.label || resume.template}</Badge>
          <Menu
            iconOnly icon="more" variant="ghost" size="sm" ariaLabel={`Actions for ${resume.name}`}
            items={[
              { label: 'Open editor', icon: 'pencil', href: `/resume/${resume.id}` },
              { label: 'Interview prep', icon: 'list', href: `/prep/${resume.id}` },
              { separator: true },
              { label: 'Download DOCX', icon: 'download', href: url('docx') },
              { label: 'Download PDF', icon: 'download', href: url('pdf') },
              { label: 'Open PDF in new tab', icon: 'external', href: `${url('pdf')}&inline=1`, external: true },
              { separator: true },
              { label: 'Duplicate', icon: 'copy', onSelect: onDuplicate },
              { label: 'Delete', icon: 'trash', tone: 'danger', onSelect: onDelete },
            ]}
          />
        </div>
      </div>
    </article>
  );
}
