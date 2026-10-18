import { notFound } from 'next/navigation';
import { ProjectForm } from '@/components/ProjectForm';
import { PageHeader } from '@/components/ui';
import { getDb } from '@/server/db';
import { HttpError } from '@/server/errors';
import { getEntity } from '@/server/library';
import type { Project } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) notFound();
  let project: Project;
  try {
    project = getEntity<Project>(getDb(), 'projects', n);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <PageHeader title={project.name} />
      <ProjectForm key={`${project.id}-${project.version}`} initial={project} />
    </>
  );
}
