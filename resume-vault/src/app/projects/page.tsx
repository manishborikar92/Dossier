import { ProjectsManager } from '@/components/projects/ProjectsManager';
import { PageHeader } from '@/components/ui';
import { getDb } from '@/server/db';
import { listEntities } from '@/server/library';
import type { Project } from '@/lib/types';

export const metadata = { title: 'Projects' };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        title="Projects"
        description="Your project library. Add each project once, then choose which ones appear on each resume."
      />
      <ProjectsManager initial={listEntities<Project>(getDb(), 'projects')} />
    </>
  );
}
