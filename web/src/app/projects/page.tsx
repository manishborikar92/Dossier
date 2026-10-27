import { ProjectsManager } from '@/components/projects/ProjectsManager';
import { getDb } from '@/server/db';
import { listEntities } from '@/server/library';
import type { Project } from '@/lib/types';

export const metadata = { title: 'Projects' };

export default function ProjectsPage() {
  return <ProjectsManager initial={listEntities<Project>(getDb(), 'projects')} />;
}
