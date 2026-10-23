import { ProjectForm } from '@/components/projects/ProjectForm';
import { PageHeader } from '@/components/ui';

export const metadata = { title: 'New project' };

export default function NewProjectPage() {
  return (
    <>
      <PageHeader title="Add a project" crumbs={[{ label: 'Projects', href: '/projects' }, { label: 'New project' }]} />
      <ProjectForm initial={null} />
    </>
  );
}
