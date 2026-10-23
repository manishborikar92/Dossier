import type { Metadata } from 'next';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { PageHeader } from '@/components/ui';
import { getDb } from '@/server/db';
import { getEntity } from '@/server/library';
import { idOrNotFound, orNotFound } from '@/server/pages';
import type { Project } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

const load = async ({ params }: Props) => {
  const id = idOrNotFound((await params).id);
  return orNotFound(() => getEntity<Project>(getDb(), 'projects', id));
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const project = await load(props);
  return { title: project.name };
}

export default async function ProjectPage(props: Props) {
  const project = await load(props);
  return (
    <>
      <PageHeader title={project.name} crumbs={[{ label: 'Projects', href: '/projects' }, { label: project.name }]} />
      <ProjectForm key={`${project.id}-${project.version}`} initial={project} />
    </>
  );
}
